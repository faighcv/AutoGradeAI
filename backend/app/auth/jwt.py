from datetime import datetime, timedelta, timezone
from jose import jwt
from typing import Optional
from ..config import settings

def create_access_token(sub: str, role: str, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = {"sub": sub, "role": role}
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str):
    try:
        parts = token.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except Exception:
        return None
