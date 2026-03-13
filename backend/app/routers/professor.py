# AUTOGRADEAI/backend/app/routers/professor.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from pathlib import Path
import csv, io, json

from .. import schemas, models
from ..deps import get_db, get_current_user
from ..utils.images import pdf_to_pngs
from ..services.grading_vision import detect_question_spans

router = APIRouter()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


# ── Role guards ───────────────────────────────────────────────────────────────

def require_prof(user=Depends(get_current_user)) -> int:
    """Legacy guard — returns user.id for backwards compat with existing routes."""
    if user.role != "PROF":
        raise HTTPException(status_code=403, detail="Professor role required")
    return user.id


def get_prof(user=Depends(get_current_user)) -> models.User:
    """Full-user guard used by new routes."""
    if user.role != "PROF":
        raise HTTPException(status_code=403, detail="Professor role required")
    return user


# ── Create exam ───────────────────────────────────────────────────────────────

@router.post("/exams", response_model=schemas.ExamOut)
def create_exam(
    payload: schemas.ExamCreate,
    user=Depends(require_prof),
    db: Session = Depends(get_db),
):
    if payload.due_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="due_at must be in the future (UTC)")
    exam = models.Exam(title=payload.title, due_at=payload.due_at, created_by=user)
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam


# ── Manual question creation (optional) ──────────────────────────────────────

@router.post("/exams/{exam_id}/questions")
def add_questions(
    exam_id: int,
    items: list[schemas.QuestionCreate],
    user=Depends(require_prof),
    db: Session = Depends(get_db),
):
    exam = db.get(models.Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    qobjs = [
        models.Question(
            exam_id=exam_id,
            idx=q.idx,
            prompt=q.prompt,
            max_points=q.max_points,
            answer_key=q.answer_key,
        )
        for q in items
    ]
    db.add_all(qobjs)
    db.commit()
    return {"count": len(qobjs)}


# ── List professor's exams ────────────────────────────────────────────────────

@router.get("/exams")
def list_my_exams(prof=Depends(get_prof), db: Session = Depends(get_db)):
    exams = (
        db.query(models.Exam)
        .filter(models.Exam.created_by == prof.id)
        .order_by(models.Exam.id.asc())
        .all()
    )
    result = []
    for e in exams:
        sub_count = (
            db.query(models.Submission)
            .filter(models.Submission.exam_id == e.id)
            .count()
        )
        graded_count = (
            db.query(models.Submission)
            .filter(
                models.Submission.exam_id == e.id,
                models.Submission.status == "GRADED",
            )
            .count()
        )
        has_solution = bool(
            db.query(models.SolutionDoc)
            .filter(models.SolutionDoc.exam_id == e.id)
            .first()
        )
        flag_count = (
            db.query(models.SimilarityFlag)
            .filter(models.SimilarityFlag.exam_id == e.id)
            .count()
        )
        result.append(
            {
                "id": e.id,
                "title": e.title,
                "due_at": e.due_at,
                "submission_count": sub_count,
                "graded_count": graded_count,
                "has_solution": has_solution,
                "flag_count": flag_count,
            }
        )
    return result


# ── Upload solution PDF ───────────────────────────────────────────────────────

@router.post("/exams/{exam_id}/solution_pdf")
def upload_solution_pdf(
    exam_id: int,
    file: UploadFile = File(...),
    prof=Depends(get_prof),
    db: Session = Depends(get_db),
):
    exam = db.get(models.Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.created_by != prof.id:
        raise HTTPException(status_code=403, detail="Not your exam")

    # Save PDF
    dest = UPLOAD_DIR / f"exam_{exam_id}_solution.pdf"
    with dest.open("wb") as f:
        f.write(file.file.read())

    # Convert → PNGs
    img_dir = UPLOAD_DIR / f"exam_{exam_id}_solution_imgs"
    solution_imgs = pdf_to_pngs(str(dest), str(img_dir))

    # Detect question spans
    spans = detect_question_spans(solution_imgs)
    qnums = sorted({item["q_idx"] for item in spans}) or [1]
    per = round(100.0 / max(1, len(qnums)), 2)

    # Upsert questions
    existing = (
        db.query(models.Question).filter(models.Question.exam_id == exam_id).all()
    )
    by_idx = {q.idx: q for q in existing}
    for idx in qnums:
        q = by_idx.get(idx)
        if not q:
            db.add(
                models.Question(
                    exam_id=exam_id,
                    idx=idx,
                    prompt=f"Q{idx}",
                    max_points=per,
                    answer_key={"images": []},
                )
            )
        else:
            q.max_points = per
    db.commit()

    # Save solution metadata
    payload = {"images": solution_imgs, "spans": spans}
    doc = (
        db.query(models.SolutionDoc)
        .filter(models.SolutionDoc.exam_id == exam_id)
        .first()
    )
    if not doc:
        db.add(
            models.SolutionDoc(
                exam_id=exam_id,
                file_path=str(dest),
                extracted_text=json.dumps(payload),
            )
        )
    else:
        doc.file_path = str(dest)
        doc.extracted_text = json.dumps(payload)
    db.commit()

    return {
        "exam_id": exam_id,
        "questions_detected": len(qnums),
        "points_per_question": per,
        "total_points": round(per * len(qnums), 2),
        "images_saved": len(solution_imgs),
    }


# ── Exam statistics ───────────────────────────────────────────────────────────

@router.get("/exams/{exam_id}/stats")
def exam_stats(
    exam_id: int, prof=Depends(get_prof), db: Session = Depends(get_db)
):
    exam = db.get(models.Exam, exam_id)
    if not exam or exam.created_by != prof.id:
        raise HTTPException(status_code=404, detail="Exam not found")

    subs = (
        db.query(models.Submission)
        .filter(models.Submission.exam_id == exam_id)
        .all()
    )
    graded = [s for s in subs if s.status == "GRADED"]

    grade_totals: list[float] = []
    for s in graded:
        g = (
            db.query(models.Grade)
            .filter(models.Grade.submission_id == s.id)
            .first()
        )
        if g:
            grade_totals.append(g.total)

    # 10-point buckets for distribution histogram
    distribution = {f"{i*10}-{(i+1)*10}": 0 for i in range(10)}
    for g in grade_totals:
        idx = min(int(g // 10), 9)
        distribution[f"{idx*10}-{(idx+1)*10}"] += 1

    flag_count = (
        db.query(models.SimilarityFlag)
        .filter(models.SimilarityFlag.exam_id == exam_id)
        .count()
    )
    has_solution = bool(
        db.query(models.SolutionDoc)
        .filter(models.SolutionDoc.exam_id == exam_id)
        .first()
    )

    return {
        "exam_id": exam_id,
        "total_submissions": len(subs),
        "graded_count": len(graded),
        "average": round(sum(grade_totals) / len(grade_totals), 2) if grade_totals else None,
        "min": round(min(grade_totals), 2) if grade_totals else None,
        "max": round(max(grade_totals), 2) if grade_totals else None,
        "distribution": distribution,
        "cheating_flags": flag_count,
        "has_solution": has_solution,
    }


# ── Export grades CSV ─────────────────────────────────────────────────────────

@router.get("/exams/{exam_id}/export_csv")
def export_grades_csv(
    exam_id: int, prof=Depends(get_prof), db: Session = Depends(get_db)
):
    exam = db.get(models.Exam, exam_id)
    if not exam or exam.created_by != prof.id:
        raise HTTPException(status_code=404, detail="Exam not found")

    subs = (
        db.query(models.Submission)
        .filter(models.Submission.exam_id == exam_id)
        .order_by(models.Submission.submitted_at.asc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ["submission_id", "student_email", "submitted_at", "status", "grade_total"]
    )
    for s in subs:
        student = db.get(models.User, s.student_id)
        grade = (
            db.query(models.Grade)
            .filter(models.Grade.submission_id == s.id)
            .first()
        )
        writer.writerow(
            [
                s.id,
                student.email if student else "unknown",
                s.submitted_at.isoformat(),
                s.status,
                grade.total if grade else "",
            ]
        )

    output.seek(0)
    return StreamingResponse(
        iter([output.read()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="exam_{exam_id}_grades.csv"'
        },
    )


# ── Extend exam deadline ──────────────────────────────────────────────────────

@router.patch("/exams/{exam_id}/extend")
def extend_deadline(
    exam_id: int,
    payload: dict,
    prof=Depends(get_prof),
    db: Session = Depends(get_db),
):
    exam = db.get(models.Exam, exam_id)
    if not exam or exam.created_by != prof.id:
        raise HTTPException(status_code=404, detail="Exam not found")

    raw = payload.get("due_at")
    if not raw:
        raise HTTPException(status_code=400, detail="due_at required")
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format")

    if dt <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="New deadline must be in the future")

    exam.due_at = dt.replace(tzinfo=None)  # store as naive UTC
    db.commit()
    return {"id": exam.id, "title": exam.title, "due_at": exam.due_at}


# ── List submissions for an exam ──────────────────────────────────────────────

@router.get("/exams/{exam_id}/submissions")
def list_submissions_for_exam(
    exam_id: int, prof=Depends(get_prof), db: Session = Depends(get_db)
):
    exam = db.get(models.Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.created_by != prof.id:
        raise HTTPException(status_code=403, detail="Not your exam")

    subs = (
        db.query(models.Submission)
        .filter(models.Submission.exam_id == exam_id)
        .order_by(models.Submission.submitted_at.asc())
        .all()
    )
    result = []
    for s in subs:
        student = db.get(models.User, s.student_id)
        grade = (
            db.query(models.Grade)
            .filter(models.Grade.submission_id == s.id)
            .first()
        )
        # Any flags involving this submission?
        flagged = bool(
            db.query(models.SimilarityFlag)
            .filter(
                (models.SimilarityFlag.submission_a == s.id)
                | (models.SimilarityFlag.submission_b == s.id)
            )
            .first()
        )
        result.append(
            {
                "submission_id": s.id,
                "student_id": s.student_id,
                "student_email": student.email if student else "unknown",
                "submitted_at": s.submitted_at,
                "status": s.status,
                "grade_total": grade.total if grade else None,
                "flagged": flagged,
            }
        )
    return result


# ── View single submission detail ─────────────────────────────────────────────

@router.get("/submissions/{submission_id}")
def view_submission(
    submission_id: int, prof=Depends(get_prof), db: Session = Depends(get_db)
):
    sub = db.get(models.Submission, submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    exam = db.get(models.Exam, sub.exam_id)
    if not exam or exam.created_by != prof.id:
        raise HTTPException(status_code=403, detail="Not your exam")

    grade = (
        db.query(models.Grade).filter(models.Grade.submission_id == sub.id).first()
    )
    answers = (
        db.query(models.Answer).filter(models.Answer.submission_id == sub.id).all()
    )
    doc = (
        db.query(models.SubmissionDoc)
        .filter(models.SubmissionDoc.submission_id == sub.id)
        .first()
    )
    student = db.get(models.User, sub.student_id)

    student_images: list = []
    if doc:
        try:
            data = json.loads(doc.extracted_text or "{}")
            student_images = data.get("images", [])
        except Exception:
            pass

    return {
        "submission_id": sub.id,
        "student_id": sub.student_id,
        "student_email": student.email if student else "unknown",
        "exam_id": sub.exam_id,
        "submitted_at": sub.submitted_at,
        "grade_total": grade.total if grade else None,
        "breakdown": grade.breakdown if grade else {},
        "answers": [{"question_id": a.question_id, "text": a.text} for a in answers],
        "student_images": student_images,
    }


# ── Similarity / cheating flags ───────────────────────────────────────────────

@router.get("/exams/{exam_id}/flags")
def get_flags(
    exam_id: int, prof=Depends(get_prof), db: Session = Depends(get_db)
):
    exam = db.get(models.Exam, exam_id)
    if not exam or exam.created_by != prof.id:
        raise HTTPException(status_code=404, detail="Exam not found")

    flags = (
        db.query(models.SimilarityFlag)
        .filter(models.SimilarityFlag.exam_id == exam_id)
        .order_by(models.SimilarityFlag.sem.desc())
        .all()
    )
    result = []
    for f in flags:
        sub_a = db.get(models.Submission, f.submission_a)
        sub_b = db.get(models.Submission, f.submission_b)
        student_a = db.get(models.User, sub_a.student_id) if sub_a else None
        student_b = db.get(models.User, sub_b.student_id) if sub_b else None
        severity = "HIGH" if (f.sem >= 0.95 or f.jacc >= 0.92) else "MEDIUM"
        result.append(
            {
                "id": f.id,
                "submission_a": f.submission_a,
                "submission_b": f.submission_b,
                "student_a_email": student_a.email if student_a else "unknown",
                "student_b_email": student_b.email if student_b else "unknown",
                "question_id": f.question_id,
                "sem": round(f.sem, 3),
                "jacc": round(f.jacc, 3),
                "reason": f.reason,
                "severity": severity,
            }
        )
    return result
