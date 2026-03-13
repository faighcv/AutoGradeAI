"""
Similarity / academic-integrity service.

Compares student submissions against each other using:
  1. OCR text extracted from images (if pytesseract is available)
  2. Grade-feedback text as a fallback proxy (no extra API calls)

Flags suspicious pairs with HIGH or MEDIUM severity.
"""
from __future__ import annotations
import re
import json
from typing import List

# ── Text similarity helpers ────────────────────────────────────────────────────

def jaccard_similarity(text_a: str, text_b: str) -> float:
    words_a = set(re.findall(r"\w+", text_a.lower()))
    words_b = set(re.findall(r"\w+", text_b.lower()))
    if not words_a or not words_b:
        return 0.0
    return len(words_a & words_b) / len(words_a | words_b)


_sem_model = None


def _get_sem_model():
    global _sem_model
    if _sem_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _sem_model = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception:
            pass
    return _sem_model


def semantic_similarity(text_a: str, text_b: str) -> float:
    if not text_a.strip() or not text_b.strip():
        return 0.0
    model = _get_sem_model()
    if model is None:
        return jaccard_similarity(text_a, text_b)
    try:
        import numpy as np
        embs = model.encode([text_a, text_b])
        a, b = embs[0], embs[1]
        norm = float(np.linalg.norm(a) * np.linalg.norm(b))
        if norm < 1e-9:
            return 0.0
        return float(max(0.0, min(1.0, float(np.dot(a, b)) / norm)))
    except Exception:
        return jaccard_similarity(text_a, text_b)


# ── OCR helper ────────────────────────────────────────────────────────────────

def ocr_images(img_paths: List[str]) -> str:
    """OCR a list of images → combined text. Empty string if unavailable."""
    try:
        import pytesseract
        from PIL import Image
        parts = []
        for p in img_paths:
            try:
                text = pytesseract.image_to_string(Image.open(p), config="--psm 3")
                if text.strip():
                    parts.append(text.strip())
            except Exception:
                pass
        return "\n\n".join(parts)
    except ImportError:
        return ""


# ── Internal: resolve text for a submission ───────────────────────────────────

def _submission_text(submission_id: int, db) -> str:
    """
    Return the best available text for a submission:
    1. OCR stored in SubmissionDoc.extracted_text["ocr"]
    2. Concatenated grade feedback (rationale + strengths + missing)
    """
    from .. import models

    doc = (
        db.query(models.SubmissionDoc)
        .filter(models.SubmissionDoc.submission_id == submission_id)
        .first()
    )
    if doc:
        try:
            data = json.loads(doc.extracted_text or "{}")
            ocr = data.get("ocr", "")
            if ocr and len(ocr.strip()) > 50:
                return ocr
        except Exception:
            pass

    # Fallback: grade feedback text
    grade = (
        db.query(models.Grade)
        .filter(models.Grade.submission_id == submission_id)
        .first()
    )
    if not grade or not grade.breakdown:
        return ""

    parts: List[str] = []
    for q_data in grade.breakdown.values():
        fb = q_data.get("feedback", {})
        parts.append(str(fb.get("rationale", "")))
        parts.extend(str(s) for s in (fb.get("strengths") or []))
        parts.extend(str(m) for m in (fb.get("missing") or []))
    return " ".join(p for p in parts if p.strip())


# ── Main entry point ──────────────────────────────────────────────────────────

def run_similarity_check(exam_id: int, new_submission_id: int, db) -> int:
    """
    Compare *new_submission_id* against every other graded submission for
    *exam_id*. Creates SimilarityFlag rows for suspicious pairs.
    Returns the number of new flags created.
    """
    from .. import models
    from ..config import settings

    other_subs = (
        db.query(models.Submission)
        .filter(
            models.Submission.exam_id == exam_id,
            models.Submission.id != new_submission_id,
            models.Submission.status == "GRADED",
        )
        .all()
    )
    if not other_subs:
        return 0

    questions = (
        db.query(models.Question)
        .filter(models.Question.exam_id == exam_id)
        .order_by(models.Question.idx)
        .all()
    )
    if not questions:
        return 0

    new_text = _submission_text(new_submission_id, db)
    if not new_text:
        return 0

    flags_created = 0

    for other_sub in other_subs:
        other_text = _submission_text(other_sub.id, db)
        if not other_text:
            continue

        jacc = jaccard_similarity(new_text, other_text)
        sem = semantic_similarity(new_text, other_text)

        if sem < settings.SIM_THRESH_SEM and jacc < settings.SIM_THRESH_JACC:
            continue

        severity = "HIGH" if (sem >= 0.95 or jacc >= 0.92) else "MEDIUM"
        sub_a = min(new_submission_id, other_sub.id)
        sub_b = max(new_submission_id, other_sub.id)

        # Use first question as anchor (one flag per submission pair)
        q = questions[0]
        existing = (
            db.query(models.SimilarityFlag)
            .filter(
                models.SimilarityFlag.exam_id == exam_id,
                models.SimilarityFlag.submission_a == sub_a,
                models.SimilarityFlag.submission_b == sub_b,
                models.SimilarityFlag.question_id == q.id,
            )
            .first()
        )
        if existing:
            # Update scores if new run is more suspicious
            if sem > existing.sem or jacc > existing.jacc:
                existing.sem = round(sem, 4)
                existing.jacc = round(jacc, 4)
                existing.reason = (
                    f"{severity}: sem={sem:.1%}, jacc={jacc:.1%} (document-level)"
                )
            continue

        db.add(
            models.SimilarityFlag(
                exam_id=exam_id,
                submission_a=sub_a,
                submission_b=sub_b,
                question_id=q.id,
                sem=round(sem, 4),
                jacc=round(jacc, 4),
                reason=f"{severity}: sem={sem:.1%}, jacc={jacc:.1%} (document-level)",
            )
        )
        flags_created += 1

    if flags_created:
        db.commit()
    return flags_created
