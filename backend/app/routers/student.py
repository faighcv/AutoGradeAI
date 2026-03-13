# AUTOGRADEAI/backend/app/routers/student.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime
from pathlib import Path
import json

from .. import schemas, models
from ..deps import get_db, get_current_user
from ..config import settings
from ..utils.images import pdf_to_pngs
from ..services.grading_vision import grade_question_images, detect_question_spans
from ..services.similarity import ocr_images, run_similarity_check

router = APIRouter()


# ── Role guard ────────────────────────────────────────────────────────────────

def require_student(user=Depends(get_current_user)):
    if user.role != "STUDENT":
        raise HTTPException(status_code=403, detail="Student role required")
    return user


# ── List open exams ───────────────────────────────────────────────────────────

@router.get("/exams/open")
def list_open_exams(user=Depends(require_student), db: Session = Depends(get_db)):
    """Exams that are still accepting submissions."""
    now = datetime.utcnow()
    exams = db.query(models.Exam).filter(models.Exam.due_at > now).all()
    return [{"id": e.id, "title": e.title, "due_at": e.due_at} for e in exams]


# ── Student's own submission history ─────────────────────────────────────────

@router.get("/submissions")
def my_submissions(user=Depends(require_student), db: Session = Depends(get_db)):
    """Return all submissions (with grades) for the current student."""
    subs = (
        db.query(models.Submission)
        .filter(models.Submission.student_id == user.id)
        .order_by(models.Submission.submitted_at.desc())
        .all()
    )
    result = []
    for s in subs:
        exam = db.get(models.Exam, s.exam_id)
        grade = (
            db.query(models.Grade)
            .filter(models.Grade.submission_id == s.id)
            .first()
        )
        result.append(
            {
                "submission_id": s.id,
                "exam_id": s.exam_id,
                "exam_title": exam.title if exam else "Unknown",
                "submitted_at": s.submitted_at,
                "status": s.status,
                "grade_total": grade.total if grade else None,
                "breakdown": grade.breakdown if grade else {},
            }
        )
    return result


# ── Submit exam PDF ───────────────────────────────────────────────────────────

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/exams/{exam_id}/submit_pdf")
def submit_pdf(
    exam_id: int,
    file: UploadFile = File(...),
    user=Depends(require_student),
    db: Session = Depends(get_db),
):
    """
    Student uploads their solved exam PDF.
    Converts to images, grades with GPT-4o Vision, then runs similarity check.
    """
    exam = db.get(models.Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    if datetime.utcnow() > exam.due_at:
        raise HTTPException(status_code=403, detail="Deadline has passed")

    # ── Save PDF ──────────────────────────────────────────────────────────────
    dest = UPLOAD_DIR / f"exam_{exam_id}_student_{user.id}.pdf"
    with dest.open("wb") as f:
        f.write(file.file.read())

    # ── PDF → PNGs ────────────────────────────────────────────────────────────
    img_dir = UPLOAD_DIR / f"exam_{exam_id}_student_{user.id}_imgs"
    student_imgs = pdf_to_pngs(str(dest), str(img_dir))

    # ── Create Submission record ──────────────────────────────────────────────
    sub = models.Submission(exam_id=exam_id, student_id=user.id, status="PENDING")
    db.add(sub)
    db.commit()
    db.refresh(sub)

    # ── Load professor solution ───────────────────────────────────────────────
    sdoc = (
        db.query(models.SolutionDoc)
        .filter(models.SolutionDoc.exam_id == exam_id)
        .first()
    )
    if not sdoc:
        raise HTTPException(
            status_code=400, detail="Professor has not uploaded a solution PDF yet"
        )

    try:
        sol_meta = json.loads(sdoc.extracted_text or "{}")
    except Exception:
        sol_meta = {}

    solution_imgs = sol_meta.get("images", [])
    spans = sol_meta.get("spans", [])

    # ── Load questions ────────────────────────────────────────────────────────
    questions = (
        db.query(models.Question)
        .filter(models.Question.exam_id == exam_id)
        .all()
    )
    by_idx = {q.idx: q for q in questions}

    if not spans:
        spans = detect_question_spans(student_imgs)

    # Naive: all pages for every question (vision model is given the full doc)
    per_question_imgs = {qidx: student_imgs for qidx in by_idx}

    # ── Grade each question ───────────────────────────────────────────────────
    total = 0.0
    breakdown = {}

    for qidx, q in sorted(by_idx.items()):
        stu_imgs = per_question_imgs.get(qidx, [])
        if not stu_imgs:
            breakdown[str(q.id)] = {
                "points": 0.0,
                "feedback": {
                    "rationale": "No images found for this question",
                    "strengths": [],
                    "missing": ["Provide answer"],
                },
            }
            continue

        result = grade_question_images(qidx, stu_imgs, solution_imgs, q.max_points)
        total += result["points"]
        breakdown[str(q.id)] = result

        db.add(
            models.Answer(
                submission_id=sub.id,
                question_id=q.id,
                text=f"[Q{qidx}: image-based answer]",
            )
        )

    db.commit()

    # ── Save grade ────────────────────────────────────────────────────────────
    grade = models.Grade(
        submission_id=sub.id, total=round(total, 2), breakdown=breakdown
    )
    sub.status = "GRADED"
    db.add(grade)
    db.commit()
    db.refresh(grade)

    # ── Save submission doc (images + OCR) ────────────────────────────────────
    ocr_text = ocr_images(student_imgs)  # empty string if pytesseract unavailable
    payload = {"images": student_imgs, "ocr": ocr_text}
    doc = models.SubmissionDoc(
        submission_id=sub.id,
        file_path=str(dest),
        extracted_text=json.dumps(payload),
    )
    db.add(doc)
    db.commit()

    # ── Academic integrity check ──────────────────────────────────────────────
    try:
        run_similarity_check(exam_id, sub.id, db)
    except Exception as exc:
        # Non-fatal — don't block the student's submission
        print(f"[similarity] check failed for submission {sub.id}: {exc}")

    return {
        "submission_id": sub.id,
        "grade_total": grade.total,
        "breakdown": breakdown,
        "answers_saved": len(questions),
    }
