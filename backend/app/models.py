from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Integer, Text, ForeignKey, DateTime, Float, JSON, UniqueConstraint
from datetime import datetime
from typing import Optional
import secrets, string

def _gen_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(8))

class Base(DeclarativeBase):
    pass

class User(Base):
    """Mirrors Supabase auth.users — id is the Supabase UUID."""
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    role: Mapped[str] = mapped_column(String(16))  # "PROF" | "STUDENT"

class Exam(Base):
    __tablename__ = "exams"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    due_at: Mapped[datetime] = mapped_column(DateTime)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    enrollment_code: Mapped[Optional[str]] = mapped_column(String(8), unique=True, index=True, default=_gen_code)

class Question(Base):
    __tablename__ = "questions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id"))
    idx: Mapped[int] = mapped_column(Integer)
    prompt: Mapped[str] = mapped_column(Text)
    max_points: Mapped[float] = mapped_column(Float)
    answer_key: Mapped[dict] = mapped_column(JSON)

class Submission(Base):
    __tablename__ = "submissions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id"))
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status: Mapped[str] = mapped_column(String(16), default="PENDING")

class Answer(Base):
    __tablename__ = "answers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id"))
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"))
    text: Mapped[str] = mapped_column(Text)

class Grade(Base):
    __tablename__ = "grades"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id"), unique=True)
    total: Mapped[float] = mapped_column(Float)
    breakdown: Mapped[dict] = mapped_column(JSON)

class SimilarityFlag(Base):
    __tablename__ = "similarity_flags"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id"))
    submission_a: Mapped[int] = mapped_column(ForeignKey("submissions.id"))
    submission_b: Mapped[int] = mapped_column(ForeignKey("submissions.id"))
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"))
    sem: Mapped[float] = mapped_column(Float)
    jacc: Mapped[float] = mapped_column(Float)
    reason: Mapped[str] = mapped_column(Text)

class ExamEnrollment(Base):
    """Links a student to an exam they joined via enrollment code."""
    __tablename__ = "exam_enrollments"
    __table_args__ = (UniqueConstraint("exam_id", "student_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id"))
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id"))

class SolutionDoc(Base):
    __tablename__ = "solution_docs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id"), unique=True, index=True)
    file_path: Mapped[str] = mapped_column(String(512))
    extracted_text: Mapped[str] = mapped_column(Text)

class SubmissionDoc(Base):
    __tablename__ = "submission_docs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id"), unique=True, index=True)
    file_path: Mapped[str] = mapped_column(String(512))
    extracted_text: Mapped[str] = mapped_column(Text)
