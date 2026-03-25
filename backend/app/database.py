import ssl
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from .config import settings

# Normalize to pg8000 (pure Python driver — no native C, no segfaults)
_db_url = settings.DATABASE_URL
if _db_url.startswith("postgresql://") or _db_url.startswith("postgresql+psycopg2://"):
    _db_url = _db_url.split("://", 1)[1]
    _db_url = "postgresql+pg8000://" + _db_url

connect_args = {}
if _db_url.startswith("postgresql+pg8000://"):
    # Supabase requires SSL
    ssl_context = ssl.create_default_context()
    connect_args["ssl_context"] = ssl_context
elif _db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    _db_url,
    echo=False,
    future=True,
    poolclass=NullPool,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
