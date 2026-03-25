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
    # ssl_context=True tells pg8000 to use Python's default SSL context
    # with proper certificate verification — required for Supabase Supavisor
    # to correctly resolve the tenant from the connection startup packet.
    connect_args["ssl_context"] = True
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
