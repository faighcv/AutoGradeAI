from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from .config import settings

# Normalize to psycopg3 (supports async, clean SSL via sslmode=require)
_db_url = settings.DATABASE_URL
if _db_url.startswith("postgresql+psycopg2://"):
    _db_url = _db_url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)
elif _db_url.startswith("postgresql+pg8000://"):
    _db_url = _db_url.replace("postgresql+pg8000://", "postgresql+psycopg://", 1)
elif _db_url.startswith("postgresql://"):
    _db_url = _db_url.replace("postgresql://", "postgresql+psycopg://", 1)

# Append sslmode=require for Supabase (pooler and direct)
if _db_url.startswith("postgresql+psycopg://"):
    sep = "&" if "?" in _db_url else "?"
    _db_url = _db_url + sep + "sslmode=require"

connect_args = {}
if _db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    _db_url,
    echo=False,
    future=True,
    poolclass=NullPool,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
