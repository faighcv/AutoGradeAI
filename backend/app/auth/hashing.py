from passlib.hash import argon2

def hash_password(p: str) -> str:
    return argon2.hash(p)

def verify_password(p: str, hashed: str) -> bool:
    return argon2.verify(p, hashed)