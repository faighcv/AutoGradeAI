from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from datetime import datetime
from .. import schemas, models
from ..deps import get_db, get_current_user

auth_scheme = HTTPBearer()
router = APIRouter()

def require_prof(creds: HTTPAuthorizationCredentials):
    data = get_current_user(creds.credentials)
    if data.get("role") != "PROF":
        raise HTTPException(status_code=403, detail="Professor role required")
    return int(data["sub"])

@router.post("/exams", response_model=schemas.ExamOut)
def create_exam(payload: schemas.ExamCreate, creds: HTTPAuthorizationCredentials = Depends(auth_scheme), db: Session = Depends(get_db)):
    prof_id = require_prof(creds)
    if payload.due_at <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="due_at must be in the future (UTC)")
    exam = models.Exam(title=payload.title, due_at=payload.due_at, created_by=prof_id)
    db.add(exam); db.commit(); db.refresh(exam)
    return exam

@router.post("/exams/{exam_id}/questions")
def add_questions(exam_id: int, items: list[schemas.QuestionCreate], creds: HTTPAuthorizationCredentials = Depends(auth_scheme), db: Session = Depends(get_db)):
    require_prof(creds)
    exam = db.query(models.Exam).get(exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="exam not found")
    qobjs = [models.Question(exam_id=exam_id, idx=q.idx, prompt=q.prompt, max_points=q.max_points, answer_key=q.answer_key) for q in items]
    db.add_all(qobjs); db.commit()
    return {"count": len(qobjs)}

@router.get("/exams/{exam_id}/flags")
def get_flags(exam_id: int, creds: HTTPAuthorizationCredentials = Depends(auth_scheme), db: Session = Depends(get_db)):
    require_prof(creds)
    flags = (db.query(models.SimilarityFlag)
               .filter(models.SimilarityFlag.exam_id == exam_id)
               .order_by(models.SimilarityFlag.sem.desc())
               .all())
    return [
        {"id": f.id, "submission_a": f.submission_a, "submission_b": f.submission_b,
         "question_id": f.question_id, "sem": round(f.sem,3), "jacc": round(f.jacc,3), "reason": f.reason}
        for f in flags
    ]
