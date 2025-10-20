from pydantic import BaseModel
import os
from datetime import timedelta
from dotenv import load_dotenv

# Load .env at project root; harmless if file is missing
load_dotenv()

class Settings(BaseModel):
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # If DATABASE_URL is missing, we fall back to sqlite so the app still boots.
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./autograde.db")

    EMBEDDINGS_MODEL: str = os.getenv("EMBEDDINGS_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    SIM_THRESH_SEM: float = float(os.getenv("SIM_THRESH_SEM", "0.90"))
    SIM_THRESH_JACC: float = float(os.getenv("SIM_THRESH_JACC", "0.80"))

settings = Settings()
ACCESS_TOKEN_EXPIRE = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
