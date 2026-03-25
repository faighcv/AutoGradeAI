from pydantic import BaseModel
import os
from dotenv import load_dotenv
from pathlib import Path

# Always load .env from repo root
ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=ROOT_ENV, override=True)
load_dotenv()

class Settings(BaseModel):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./autograde.db")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    SIM_THRESH_SEM: float = float(os.getenv("SIM_THRESH_SEM", "0.90"))
    SIM_THRESH_JACC: float = float(os.getenv("SIM_THRESH_JACC", "0.80"))
    MAX_IMAGES_PER_CALL: int = int(os.getenv("MAX_IMAGES_PER_CALL", "10"))
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o")

settings = Settings()