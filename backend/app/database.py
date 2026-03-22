from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from .config import settings

# Normalize Railway's postgresql:// to use psycopg2 explicitly
_db_url = settings.DATABASE_URL
if _db_url.startswith("postgresql://"):
    _db_url = _db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

connect_args = {}

if _db_url.startswith("postgresql+psycopg://"):
    connect_args["prepare_threshold"] = None

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