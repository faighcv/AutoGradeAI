from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Dict, Any

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str  # PROF or STUDENT

class QuestionCreate(BaseModel):
    idx: int
    prompt: str
    max_points: float
    answer_key: Dict[str, Any]

class ExamCreate(BaseModel):
    title: str
    due_at: datetime

class ExamOut(BaseModel):
    id: int
    title: str
    due_at: datetime
    enrollment_code: str | None = None
    class Config:
        from_attributes = True

class AnswerIn(BaseModel):
    question_id: int
    text: str

class SubmissionCreate(BaseModel):
    answers: List[AnswerIn]
