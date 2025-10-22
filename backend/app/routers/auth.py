from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from .. import schemas, models
from ..auth.hashing import hash_password, verify_password
from ..auth.jwt import create_access_token
from ..deps import get_db

router = APIRouter()

@router.post("/register")
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if user.role not in {"PROF", "STUDENT"}:
        raise HTTPException(status_code=400, detail="role must be PROF or STUDENT")
    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(status_code=400, detail="email already registered")
    u = models.User(email=user.email, hashed_password=hash_password(user.password), role=user.role)
    db.add(u); db.commit(); db.refresh(u)
    return {"id": u.id, "email": u.email, "role": u.role}

@router.post("/login", response_model=schemas.Token)
def login(creds: schemas.UserCreate, db: Session = Depends(get_db)):
    u = db.query(models.User).filter(models.User.email == creds.email).first()
    if not u or not verify_password(creds.password, u.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token(sub=str(u.id), role=u.role)
    return {"access_token": token}
