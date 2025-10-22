from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from .. import models
from ..deps import get_db, get_current_user

auth_scheme = HTTPBearer()
router = APIRouter()

def require_user(creds: HTTPAuthorizationCredentials):
    return get_current_user(creds.credentials)

@router.get("/submissions/{submission_id}")
def get_grade(submission_id: int, creds: HTTPAuthorizationCredentials = Depends(auth_scheme), db: Session = Depends(get_db)):
    require_user(creds)
    g = db.query(models.Grade).filter(models.Grade.submission_id == submission_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="grade not found")
    return {"submission_id": submission_id, "total": g.total, "breakdown": g.breakdown}
