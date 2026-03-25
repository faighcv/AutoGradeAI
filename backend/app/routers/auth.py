from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models
from ..deps import get_db, get_current_user
from ..deps import _supabase

router = APIRouter()


@router.post("/profile/init")
def init_profile(payload: dict, db: Session = Depends(get_db)):
    """Called right after supabase.auth.signUp() — no JWT needed.
    Verifies the user exists in Supabase auth via service key, then upserts profile."""
    user_id = payload.get("user_id", "").strip()
    role = payload.get("role", "STUDENT")
    if role not in {"PROF", "STUDENT"}:
        raise HTTPException(400, "role must be PROF or STUDENT")
    if not user_id:
        raise HTTPException(400, "user_id required")
    try:
        resp = _supabase.auth.admin.get_user_by_id(user_id)
        sb_user = resp.user
        if not sb_user:
            raise HTTPException(400, "User not found")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Could not verify user with Supabase")
    # Only allow fresh signups (within last 10 minutes) to prevent abuse
    created = sb_user.created_at
    if isinstance(created, str):
        created = datetime.fromisoformat(created.replace("Z", "+00:00"))
    if datetime.now(timezone.utc) - created > timedelta(minutes=10):
        raise HTTPException(400, "Signup token expired — please register again")
    existing = db.query(models.User).filter(models.User.id == str(sb_user.id)).first()
    if existing:
        existing.role = role
    else:
        db.add(models.User(id=str(sb_user.id), email=sb_user.email, role=role))
    db.commit()
    return {"ok": True}


@router.post("/profile")
def create_profile(payload: dict, db: Session = Depends(get_db),
                   user=Depends(get_current_user)):
    """Called by frontend after Supabase signUp to store role in our DB."""
    role = payload.get("role", "STUDENT")
    if role not in {"PROF", "STUDENT"}:
        raise HTTPException(400, "role must be PROF or STUDENT")
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
