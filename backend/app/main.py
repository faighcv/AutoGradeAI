import os
import logging
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .database import engine
from .models import Base
from .routers import auth as auth_router
from .routers import professor as professor_router
from .routers import student as student_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Keepalive thread — prevents process from exiting when idle
def _keepalive():
    import time
    while True:
        time.sleep(30)

threading.Thread(target=_keepalive, daemon=True).start()

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        logger.info("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables ready.")
    except Exception as e:
        logger.error(f"DB init failed: {e}")
        raise
    yield

app = FastAPI(title="AutoGradeAI (Cookie Sessions)", lifespan=lifespan)

_origins = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "https://auto-grade-ai.vercel.app",
]
_frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
if _frontend_url and _frontend_url not in _origins:
    _origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"ok": True, "app": "AutoGradeAI"}

# Optional: to verify cookies exist
@app.get("/debug/cookies")
def debug_cookies(request: Request):
    return {"cookies": request.cookies}

# Routers
app.include_router(auth_router.router, prefix="/auth", tags=["auth"])
app.include_router(professor_router.router, prefix="/prof", tags=["professor"])
app.include_router(student_router.router, prefix="/student", tags=["student"])
