import os
import sys
import signal
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

# Signal handlers — log signals before exiting so we know the cause
def _sig_handler(signum, frame):
    print(f"FATAL: received signal {signum} (SIGTERM=15, SIGINT=2, SIGHUP=1) — exiting", flush=True)
    sys.exit(0)

signal.signal(signal.SIGTERM, _sig_handler)
signal.signal(signal.SIGHUP, _sig_handler)

# Heartbeat — proves process is alive; also detects OOM (no more logs after kill)
def _heartbeat():
    import time
    i = 0
    while True:
        time.sleep(10)
        i += 1
        print(f"HEARTBEAT {i*10}s — pid={os.getpid()} alive", flush=True)

threading.Thread(target=_heartbeat, daemon=True).start()
print("STARTUP: main.py loaded, heartbeat started", flush=True)

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
