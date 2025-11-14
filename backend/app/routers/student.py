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

router = APIRouter()

# ----------------------------- Helpers -----------------------------
def require_student(user=Depends(get_current_user)):
    """Ensure only students can access these endpoints."""
    if user.role != "STUDENT":
        raise HTTPException(status_code=403, detail="Student role required")
    return user


# ----------------------------- View Open Exams -----------------------------
@router.get("/exams/open")
def list_open_exams(user=Depends(require_student), db: Session = Depends(get_db)):
    """List exams that are still open for submission."""
    now = datetime.utcnow()
    exams = db.query(models.Exam).filter(models.Exam.due_at > now).all()
    return [{"id": e.id, "title": e.title, "due_at": e.due_at} for e in exams]


# ----------------------------- Submit Exam as PDF (Vision-based) -----------------------------
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

@router.post("/exams/{exam_id}/submit_pdf")
def submit_pdf(
    exam_id: int,
    file: UploadFile = File(...),
    user=Depends(require_student),
    db: Session = Depends(get_db)
):
    """
    Student uploads their solved exam PDF.
    Converts it to images, uses solution metadata to grade visually.
    """
    exam = db.query(models.Exam).get(exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="exam not found")
    if datetime.utcnow() > exam.due_at:
        raise HTTPException(status_code=403, detail="deadline passed")

    # 1️⃣ Save the PDF
    dest = UPLOAD_DIR / f"exam_{exam_id}_student_{user.id}.pdf"
    with dest.open("wb") as f:
        f.write(file.file.read())

    # 2️⃣ Convert PDF → PNGs
    img_dir = UPLOAD_DIR / f"exam_{exam_id}_student_{user.id}_imgs"
    student_imgs = pdf_to_pngs(str(dest), str(img_dir))

    # 3️⃣ Create Submission entry
    sub = models.Submission(exam_id=exam_id, student_id=user.id, status="PENDING")
    db.add(sub)
    db.commit()
    db.refresh(sub)

    # 4️⃣ Load professor's solution metadata
    sdoc = db.query(models.SolutionDoc).filter(models.SolutionDoc.exam_id == exam_id).first()
    if not sdoc:
        raise HTTPException(status_code=400, detail="Professor has not uploaded a solution PDF yet")

    try:
        sol_meta = json.loads(sdoc.extracted_text or "{}")
    except Exception:
        sol_meta = {}

    solution_imgs = sol_meta.get("images", [])
    spans = sol_meta.get("spans", [])

    # 5️⃣ Get questions from DB
    questions = db.query(models.Question).filter(models.Question.exam_id == exam_id).all()
    by_idx = {q.idx: q for q in questions}

    # 6️⃣ If professor spans missing, detect locally (fallback)
    if not spans:
        spans = detect_question_spans(student_imgs)

    # 7️⃣ Associate student images per question
    # (Naive version: all pages → each question. You can refine by spans later.)
    per_question_imgs = {qidx: student_imgs for qidx in by_idx.keys()}

    # 8️⃣ Grade each question visually
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

        # Store minimal answer text ref for traceability
        db.add(models.Answer(submission_id=sub.id, question_id=q.id, text=f"[Q{qidx}: image-based answer]"))

    db.commit()

    # 9️⃣ Store grade
    grade = models.Grade(submission_id=sub.id, total=round(total, 2), breakdown=breakdown)
    sub.status = "GRADED"
    db.add(grade)
    db.commit()
    db.refresh(grade)

    # 🔟 Save student image metadata
    payload = {"images": student_imgs}
    doc = models.SubmissionDoc(submission_id=sub.id, file_path=str(dest), extracted_text=json.dumps(payload))
    db.add(doc)
    db.commit()

    return {
        "submission_id": sub.id,
        "grade_total": grade.total,
        "breakdown": breakdown,
        "answers_saved": len(questions)
    }


