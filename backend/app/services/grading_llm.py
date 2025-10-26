# AUTOGRADEAI/backend/app/services/grading_llm.py
from __future__ import annotations
import json
from typing import Dict, Any
from openai import OpenAI
from ..config import settings

_client = None
def client() -> OpenAI:
    """Lazily init OpenAI client."""
    global _client
    if _client is None:
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY missing in .env")
        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client

SYSTEM_PROMPT = (
    "You are an auto-grader for short-answer STEM exams. "
    "Use the official solution as the source of truth. "
    "Award partial credit when reasoning/steps are correct even if final number differs. "
    "Be concise. Return STRICT JSON only."
)

def _empty_or_low_conf(text: str) -> bool:
    """Heuristic for OCR failures / empty answers."""
    if not text: 
        return True
    t = text.strip()
    # very short or mostly non-alnum -> likely junk OCR
    alnum = sum(ch.isalnum() for ch in t)
    return len(t) < 15 or alnum < max(5, int(0.2 * len(t)))

def grade_answer_with_openai(
    student_answer: str,
    question_text: str,
    answer_key_text: str,
    max_points: float
) -> Dict[str, Any]:
    # If OCR clearly failed / blank, short-circuit with an explanatory feedback.
    if _empty_or_low_conf(student_answer):
        return {
            "points": 0.0,
            "feedback": {
                "rationale": "No usable text extracted from the student's PDF (OCR likely failed or answer left blank).",
                "strengths": [],
                "missing": ["Provide readable text or write steps/answer"]
            }
        }

    # Compose the single message for json_object response format
    user_prompt = f"""
Grade the student's short answer.

Question:
\"\"\"{(question_text or "").strip()}\"\"\"

Official solution / answer key:
\"\"\"{(answer_key_text or "").strip()}\"\"\"

Student answer:
\"\"\"{(student_answer or "").strip()}\"\"\"

Max points: {max_points}

Rules:
- Give partial credit for correct ideas, steps, or formulas.
- If the answer is irrelevant, give 0.
- Prefer a brief, concrete rationale (1–3 sentences).

Return STRICT JSON with exactly:
{{
  "points": number between 0 and {max_points},
  "rationale": "short text",
  "strengths": ["keyword", ...],
  "missing": ["keyword", ...]
}}
"""

    # Use chat.completions with response_format=json_object to force valid JSON
    resp = client().chat.completions.create(
        model=settings.OPENAI_MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
    )

    content = resp.choices[0].message.content or "{}"
    try:
        data = json.loads(content)
    except Exception:
        data = {"points": 0, "rationale": "Model returned non-JSON", "strengths": [], "missing": []}

    # sanitize points
    try:
        pts = float(data.get("points", 0))
    except Exception:
        pts = 0.0
    pts = max(0.0, min(float(max_points), pts))

    return {
        "points": round(pts, 2),
        "feedback": {
            "rationale": str(data.get("rationale", ""))[:1000],
            "strengths": list(data.get("strengths", []))[:10],
            "missing": list(data.get("missing", []))[:10],
        },
    }
