from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models
from ..deps import get_db, get_current_user
from ..deps import _supabase

router = APIRouter()


@router.post("/profile")
def create_profile(payload: dict, db: Session = Depends(get_db),
                   user=Depends(get_current_user)):
    """Called by frontend after Supabase signUp to store role in our DB."""
    role = payload.get("role", "STUDENT")
    if role not in {"PROF", "STUDENT"}:
        raise HTTPException(400, "role must be PROF or STUDENT")
    # upsert — in case of retry
    existing = db.query(models.User).filter(models.User.id == user.id).first()
    if existing:
        existing.role = role
    else:
        db.add(models.User(id=user.id, email=user.email, role=role))
    db.commit()
    return {"id": user.id, "email": user.email, "role": role}


@router.get("/me")
def me(user=Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "role": user.role}
