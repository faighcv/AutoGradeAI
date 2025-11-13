from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from pathlib import Path

from .. import schemas, models
from ..deps import get_db, get_current_user
from ..utils.pdf import extract_pdf_text
from ..services.parser import split_answers_by_question

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
    """
    Professor creates a new exam.
    """
    # ✅ FIXED: use timezone-aware UTC datetime for comparison
    if payload.due_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="due_at must be in the future (UTC)")
    
    exam = models.Exam(title=payload.title, due_at=payload.due_at, created_by=user)
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam

# ----------------------------- Add Questions -----------------------------
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

# ----------------------------- Upload Professor Solution PDF -----------------------------
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
    Upload and parse the professor's official solution PDF.
    Extracts answers and auto-generates question list if not already present.
    """
    exam = db.query(models.Exam).get(exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="exam not found")

    dest = UPLOAD_DIR / f"exam_{exam_id}_solution.pdf"
    with dest.open("wb") as f:
        f.write(file.file.read())

    text = extract_pdf_text(str(dest))
    qanswers = split_answers_by_question(text)  # {idx: answer_text}
    if not qanswers:
        raise HTTPException(status_code=400, detail="No questions detected in solution PDF")

    n = max(1, len(qanswers))
    per = round(100.0 / n, 2)

    # Upsert questions with normalized points
    existing = db.query(models.Question).filter(models.Question.exam_id == exam_id).all()
    by_idx = {q.idx: q for q in existing}

    count_new = 0
    for idx, ans_text in sorted(qanswers.items()):
        q = by_idx.get(idx)
        if not q:
            q = models.Question(
                exam_id=exam_id,
                idx=idx,
                prompt=f"Q{idx}",
                max_points=per,
                answer_key={"text": ans_text, "keywords": []},
            )
            db.add(q)
            count_new += 1
        else:
            q.answer_key = {
                "text": ans_text,
                "keywords": (q.answer_key or {}).get("keywords", []),
            }
            q.max_points = per
    db.commit()

    # Record solution document metadata
    doc = db.query(models.SolutionDoc).filter(models.SolutionDoc.exam_id == exam_id).first()
    if not doc:
        db.add(models.SolutionDoc(exam_id=exam_id, file_path=str(dest), extracted_text=text))
    else:
        doc.file_path = str(dest)
        doc.extracted_text = text
    db.commit()

    return {
        "exam_id": exam_id,
        "questions_detected": n,
        "points_per_question": per,
        "total_points": round(per * n, 2),
    }
