from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..deps import get_db, get_current_user
from .. import models

router = APIRouter()

@router.get("/submissions/{submission_id}")
def get_grade(submission_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    g = db.query(models.Grade).filter(models.Grade.submission_id == submission_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="grade not found")

    sub = db.query(models.Submission).get(g.submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="submission not found")

    qpoints = db.query(models.Question.max_points).filter(models.Question.exam_id == sub.exam_id).all()
    max_total = float(sum(p[0] for p in qpoints)) if qpoints else 0.0
    percent = round((g.total / max_total) * 100.0, 2) if max_total else 0.0

    return {"submission_id": submission_id, "total": g.total, "max_total": max_total, "percent": percent, "breakdown": g.breakdown}
