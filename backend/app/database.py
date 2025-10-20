from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .config import settings

# Only SQLite needs this special arg; Postgres (Supabase) does not.
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

# Global SQLAlchemy engine — main.py imports this name
engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    connect_args=connect_args
)

# Session factory
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
