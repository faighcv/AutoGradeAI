from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .database import engine
from .models import Base
from .routers import auth as auth_router
from .routers import professor as professor_router
from .routers import student as student_router
from .routers import grading as grading_router

app = FastAPI(title="AutoGradeAI (Cookie Sessions)")

# ✅ Correct CORS setup for cookies
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

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
app.include_router(grading_router.router, prefix="/grade", tags=["grading"])
