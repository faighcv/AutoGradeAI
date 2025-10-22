from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from datetime import datetime
from .. import schemas, models
from ..deps import get_db, get_current_user
from ..services.grading import score_answer
from ..services.similarity import flag_pairs
from ..config import settings

auth_scheme = HTTPBearer()
router = APIRouter()

def require_student(creds: HTTPAuthorizationCredentials):
    data = get_current_user(creds.credentials)
    if data.get("role") != "STUDENT":
        raise HTTPException(status_code=403, detail="Student role required")
    return int(data["sub"])

@router.get("/exams/open")
def list_open_exams(creds: HTTPAuthorizationCredentials = Depends(auth_scheme), db: Session = Depends(get_db)):
    require_student(creds)
    now = datetime.utcnow()
    exams = db.query(models.Exam).filter(models.Exam.due_at > now).all()
    return [{"id": e.id, "title": e.title, "due_at": e.due_at} for e in exams]

@router.post("/exams/{exam_id}/submit")
def submit(exam_id: int, payload: schemas.SubmissionCreate, creds: HTTPAuthorizationCredentials = Depends(auth_scheme), db: Session = Depends(get_db)):
    student_id = require_student(creds)
    exam = db.query(models.Exam).get(exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="exam not found")
    if datetime.utcnow() > exam.due_at:
        raise HTTPException(status_code=403, detail="deadline passed")

    sub = models.Submission(exam_id=exam_id, student_id=student_id, status="PENDING")
    db.add(sub); db.commit(); db.refresh(sub)

    qids = {q.id: q for q in db.query(models.Question).filter(models.Question.exam_id == exam_id).all()}
    ans_objs = []
    for a in payload.answers:
        if a.question_id not in qids:
            raise HTTPException(status_code=400, detail=f"invalid question_id {a.question_id}")
        ans_objs.append(models.Answer(submission_id=sub.id, question_id=a.question_id, text=a.text))
    db.add_all(ans_objs); db.commit()

    total = 0.0
    breakdown = {}
    for a in ans_objs:
        q = qids[a.question_id]
        result = score_answer(a.text, q.answer_key, q.max_points)
        total += result["points"]
        breakdown[str(a.question_id)] = result

    grade = models.Grade(submission_id=sub.id, total=round(total, 2), breakdown=breakdown)
    sub.status = "GRADED"
    db.add(grade); db.commit(); db.refresh(grade)

    # similarity flags per question
    for qid in qids:
        all_answers = (db.query(models.Answer)
                         .join(models.Submission, models.Submission.id == models.Answer.submission_id)
                         .filter(models.Submission.exam_id == exam_id, models.Answer.question_id == qid)
                         .all())
        payloads = [{"submission_id": x.submission_id, "text": x.text} for x in all_answers]
        for p in flag_pairs(payloads, settings.SIM_THRESH_SEM, settings.SIM_THRESH_JACC):
            exists = (db.query(models.SimilarityFlag)
                        .filter(models.SimilarityFlag.exam_id == exam_id,
                                models.SimilarityFlag.submission_a == p["submission_a"],
                                models.SimilarityFlag.submission_b == p["submission_b"],
                                models.SimilarityFlag.question_id == qid).first())
            if not exists and p["submission_a"] != p["submission_b"]:
                db.add(models.SimilarityFlag(
                    exam_id=exam_id, submission_a=p["submission_a"], submission_b=p["submission_b"],
                    question_id=qid, sem=p["sem"], jacc=p["jacc"],
                    reason=f"Q{qid}: cosine {p['sem']:.2f}, jacc {p['jacc']:.2f}"
                ))
        db.commit()

    return {"submission_id": sub.id, "grade_total": grade.total, "breakdown": grade.breakdown}
