from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from .config import settings

_db_url = settings.DATABASE_URL

# Normalize to pg8000 (pure Python — no native C, no segfaults)
if _db_url.startswith("postgresql+psycopg2://") or _db_url.startswith("postgresql+psycopg://"):
    _db_url = "postgresql+pg8000://" + _db_url.split("://", 1)[1]
elif _db_url.startswith("postgresql://"):
    _db_url = "postgresql+pg8000://" + _db_url.split("://", 1)[1]

connect_args = {}
if _db_url.startswith("postgresql+pg8000://"):
    # Only use SSL for external hosts (e.g. Supabase). Railway internal
    # connections (.railway.internal) don't need or support SSL.
    if ".railway.internal" not in _db_url:
        import ssl
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
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
