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
    return {"submission_id": submission_id, "total": g.total, "breakdown": g.breakdown}
