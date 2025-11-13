from fastapi import HTTPException, status, Request, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from .database import SessionLocal
from .models import Session as DBSession, User

COOKIE_NAME = "ag_session"

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    sid = request.cookies.get(COOKIE_NAME)
    if not sid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    s = db.query(DBSession).filter(DBSession.id == sid).first()
    if not s or s.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    u = db.query(User).get(s.user_id)
    if not u:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return u
