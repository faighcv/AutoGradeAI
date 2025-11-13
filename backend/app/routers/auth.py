from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import uuid

from .. import schemas, models
from ..auth.hashing import hash_password, verify_password
from ..deps import get_db
from ..config import settings

router = APIRouter()

@router.post("/register")
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if user.role not in {"PROF", "STUDENT"}:
        raise HTTPException(status_code=400, detail="role must be PROF or STUDENT")

    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(status_code=400, detail="email already registered")

    u = models.User(email=user.email, hashed_password=hash_password(user.password), role=user.role)
    db.add(u)
    db.commit()
    db.refresh(u)
    return {"id": u.id, "email": u.email, "role": u.role}


@router.post("/login")
def login(data: dict, response: Response, db: Session = Depends(get_db)):
    """
    Accepts JSON body like: { "email": "...", "password": "...", "role": "PROF" }
    """
    email = data.get("email")
    password = data.get("password")
    role = data.get("role")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Missing credentials")

    u = db.query(models.User).filter(models.User.email == email).first()
    if not u or not verify_password(password, u.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Optional: enforce role correctness
    if role and role != u.role:
        raise HTTPException(status_code=401, detail=f"Role mismatch. This account is a {u.role}")

    sid = uuid.uuid4().hex
    expires = datetime.utcnow() + timedelta(hours=settings.SESSION_EXPIRE_HOURS)
    db.add(models.Session(id=sid, user_id=u.id, expires_at=expires))
    db.commit()

    response.set_cookie(
        key="ag_session",
        value=sid,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=settings.SESSION_EXPIRE_HOURS * 3600,
        path="/",
    )

    return {"id": u.id, "email": u.email, "role": u.role}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("ag_session", path="/")
    return {"ok": True}