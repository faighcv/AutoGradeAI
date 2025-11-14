# AUTOGRADEAI/backend/app/routers/professor.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from pathlib import Path
import json

from .. import schemas, models
from ..deps import get_db, get_current_user
from ..utils.images import pdf_to_pngs
from ..services.grading_vision import detect_question_spans

router = APIRouter()

# ----------------------------- Helpers -----------------------------
def require_prof(user=Depends(get_current_user)) -> int:
    """Ensure only professors can access these endpoints."""
    if user.role != "PROF":
        raise HTTPException(status_code=403, detail="Professor role required")
    return user.id


# ----------------------------- Create Exam -----------------------------
@router.post("/exams", response_model=schemas.ExamOut)
def create_exam(payload: schemas.ExamCreate, user=Depends(require_prof), db: Session = Depends(get_db)):
    """Professor creates a new exam."""
    if payload.due_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="due_at must be in the future (UTC)")
    
    exam = models.Exam(title=payload.title, due_at=payload.due_at, created_by=user)
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam


# ----------------------------- Add Questions (manual option) -----------------------------
@router.post("/exams/{exam_id}/questions")
def add_questions(exam_id: int, items: list[schemas.QuestionCreate], user=Depends(require_prof), db: Session = Depends(get_db)):
    exam = db.query(models.Exam).get(exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="exam not found")

    qobjs = [
        models.Question(
            exam_id=exam_id,
            idx=q.idx,
            prompt=q.prompt,
            max_points=q.max_points,
            answer_key=q.answer_key
        ) for q in items
    ]
    db.add_all(qobjs)
    db.commit()
    return {"count": len(qobjs)}


# ----------------------------- View Similarity Flags -----------------------------
@router.get("/exams/{exam_id}/flags")
def get_flags(exam_id: int, user=Depends(require_prof), db: Session = Depends(get_db)):
    flags = (
        db.query(models.SimilarityFlag)
        .filter(models.SimilarityFlag.exam_id == exam_id)
        .order_by(models.SimilarityFlag.sem.desc())
        .all()
    )
    return [
        {
            "id": f.id,
            "submission_a": f.submission_a,
            "submission_b": f.submission_b,
            "question_id": f.question_id,
            "sem": round(f.sem, 3),
            "jacc": round(f.jacc, 3),
            "reason": f.reason,
        }
        for f in flags
    ]


# ----------------------------- Upload Professor Solution PDF (Vision-based) -----------------------------
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

@router.post("/exams/{exam_id}/solution_pdf")
def upload_solution_pdf(
    exam_id: int,
    file: UploadFile = File(...),
    user=Depends(require_prof),
    db: Session = Depends(get_db)
):
    """
    Upload and process the professor's official solution PDF.
    Converts it to PNGs, uses vision model to detect question regions,
    and stores metadata in the database.
    """
    exam = db.query(models.Exam).get(exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="exam not found")

    # 1️⃣ Save uploaded PDF
    dest = UPLOAD_DIR / f"exam_{exam_id}_solution.pdf"
    with dest.open("wb") as f:
        f.write(file.file.read())

    # 2️⃣ Convert PDF → PNGs
    img_dir = UPLOAD_DIR / f"exam_{exam_id}_solution_imgs"
    solution_imgs = pdf_to_pngs(str(dest), str(img_dir))

    # 3️⃣ Detect question spans using vision model
    spans = detect_question_spans(solution_imgs)  # [{'q_idx':1,'segments':[...]}...]

    # 4️⃣ Upsert questions based on detected question numbers
    qnums = sorted({item["q_idx"] for item in spans}) or [1]
    per = round(100.0 / max(1, len(qnums)), 2)

    existing = db.query(models.Question).filter(models.Question.exam_id == exam_id).all()
    by_idx = {q.idx: q for q in existing}
    count_new = 0
    for idx in qnums:
        q = by_idx.get(idx)
        if not q:
            q = models.Question(
                exam_id=exam_id,
                idx=idx,
                prompt=f"Q{idx}",
                max_points=per,
                answer_key={"images": []},  # store reference metadata
            )
            db.add(q)
            count_new += 1
        else:
            q.max_points = per
    db.commit()

    # 5️⃣ Save metadata (image paths + spans)
    payload = {"images": solution_imgs, "spans": spans}
    doc = db.query(models.SolutionDoc).filter(models.SolutionDoc.exam_id == exam_id).first()
    if not doc:
        db.add(models.SolutionDoc(
            exam_id=exam_id,
            file_path=str(dest),
            extracted_text=json.dumps(payload)  # reuse field as JSON store
        ))
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


@router.get("/exams")
def list_my_exams(user=Depends(require_prof), db: Session = Depends(get_db)):
    exams = (
        db.query(models.Exam)
        .filter(models.Exam.created_by == user)
        .order_by(models.Exam.id.asc())
        .all()
    )

    return [
        {
            "id": e.id,
            "title": e.title,
            "due_at": e.due_at,
        }
        for e in exams
    ]

@router.get("/exams/{exam_id}/submissions")
def list_submissions_for_exam(
    exam_id: int,
    user=Depends(require_prof),
    db: Session = Depends(get_db)
):
    exam = db.query(models.Exam).get(exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # SECURITY: Only see exams professor owns
    if exam.created_by != user:
        raise HTTPException(status_code=403, detail="Not your exam")

    subs = (
        db.query(models.Submission)
        .filter(models.Submission.exam_id == exam_id)
        .order_by(models.Submission.submitted_at.asc())
        .all()
    )

    out = []
    for s in subs:
        grade = db.query(models.Grade).filter(models.Grade.submission_id == s.id).first()

        out.append({
            "submission_id": s.id,
            "student_id": s.student_id,
            "submitted_at": s.submitted_at,
            "status": s.status,
            "grade_total": grade.total if grade else None
        })

    return out


@router.get("/submissions/{submission_id}")
def view_submission(
    submission_id: int,
    user=Depends(require_prof),
    db: Session = Depends(get_db)
):
    sub = db.query(models.Submission).get(submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    exam = db.query(models.Exam).get(sub.exam_id)

    # SECURITY: allow only professor of this exam
    if exam.created_by != user:
        raise HTTPException(status_code=403, detail="Not your exam")

    grade = db.query(models.Grade).filter(models.Grade.submission_id == sub.id).first()
    answers = db.query(models.Answer).filter(models.Answer.submission_id == sub.id).all()

    doc = db.query(models.SubmissionDoc).filter(
        models.SubmissionDoc.submission_id == sub.id
    ).first()

    student_images = []
    if doc:
        data = json.loads(doc.extracted_text or "{}")
        student_images = data.get("images", [])

    return {
        "submission_id": sub.id,
        "student_id": sub.student_id,
        "exam_id": sub.exam_id,
        "submitted_at": sub.submitted_at,
        "grade_total": grade.total if grade else None,
        "breakdown": grade.breakdown if grade else {},
        "answers": [
            {
                "question_id": a.question_id,
                "text": a.text
            }
            for a in answers
        ],
        "student_images": student_images
    }

