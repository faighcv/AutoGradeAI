from pydantic import BaseModel
import os
from datetime import timedelta
from dotenv import load_dotenv
from pathlib import Path

# Always load .env from repo root
ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=ROOT_ENV, override=True)
load_dotenv()

class Settings(BaseModel):
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./autograde.db")
    EMBEDDINGS_MODEL: str = os.getenv("EMBEDDINGS_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    SIM_THRESH_SEM: float = float(os.getenv("SIM_THRESH_SEM", "0.90"))
    SIM_THRESH_JACC: float = float(os.getenv("SIM_THRESH_JACC", "0.80"))

    SESSION_EXPIRE_HOURS: int = int(os.getenv("SESSION_EXPIRE_HOURS", "12"))

    # ✅ NEW: OpenAI configuration
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

settings = Settings()
ACCESS_TOKEN_EXPIRE = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
