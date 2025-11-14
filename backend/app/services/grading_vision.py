# backend/app/services/grading_vision.py
from __future__ import annotations
import base64, json
from typing import Dict, List, Any, Tuple
from openai import OpenAI
from pathlib import Path
from ..config import settings

_client = None
def client() -> OpenAI:
    global _client
    if _client is None:
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY missing in .env")
        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client

def _img_to_data_url(path: str) -> str:
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:image/png;base64,{b64}"

def _vision_call_json(messages: List[Dict[str, Any]]) -> Dict[str, Any]:
    # Use JSON "forced" style — for GPT-4o you can ask for JSON in the instruction
    resp = client().chat.completions.create(
        model=settings.OPENAI_MODEL,
        temperature=0.1,
        messages=messages,
        response_format={"type": "json_object"},
    )
    content = resp.choices[0].message.content or "{}"
    try:
        return json.loads(content)
    except Exception:
        return {}

# ---------- 1) Detect question spans on SOLUTION images ----------
def detect_question_spans(solution_imgs: List[str]) -> List[Dict[str, Any]]:
    """
    Ask the vision model to find question headers (Q1/Q2/Question 1/2...) across images
    and return spans as a list of:
      [{ "q_idx": 1, "segments": [{"page":1,"y_top":0.12,"y_bottom":0.35}, ...] }, ...]
    y_top/y_bottom are relative (0..1). Page is 1-based index.
    """
    # Provide up to 10 images per request; if more pages, run multiple passes and merge.
    chunks = [solution_imgs[i:i+settings.MAX_IMAGES_PER_CALL]
              for i in range(0, len(solution_imgs), settings.MAX_IMAGES_PER_CALL)]
    all_spans: Dict[int, List[Dict[str, Any]]] = {}

    for cidx, chunk in enumerate(chunks):
        msgs = [
            {"role": "system", "content": "You are a document analyst. Return STRICT JSON only."},
            {"role": "user", "content": [
                {"type":"text","text":(
                    "Find question boundaries labeled like 'Q1', 'Q2', 'Question 1', etc. "
                    "For each question number q, return a list of vertical bands (per page) "
                    "covering that question's content. Use relative y positions in [0,1]. "
                    "Schema:\n{\n  \"items\": [\n    {\"q_idx\": number, \"segments\": ["
                    "{\"page\": number, \"y_top\": number, \"y_bottom\": number}]}\n  ]\n}\n"
                    "Be conservative and include all relevant content blocks."
                )},
                *[
                    {"type":"image_url", "image_url":{"url": _img_to_data_url(p)}}
                    for p in chunk
                ],
            ]}
        ]
        out = _vision_call_json(msgs)
        for item in out.get("items", []):
            q = int(item.get("q_idx", 0))
            segs = item.get("segments", [])
            if q <= 0: 
                continue
            all_spans.setdefault(q, []).extend(segs)

    # Normalize/merge; return sorted by q_idx
    merged = [{"q_idx": q, "segments": segs} for q, segs in sorted(all_spans.items())]
    return merged

# ---------- 2) Crop helper (optional) ----------
from PIL import Image

def crop_segments(img_path: str, y_top: float, y_bottom: float) -> Image.Image:
    im = Image.open(img_path)
    w, h = im.size
    y1 = max(0, int(y_top * h))
    y2 = min(h, int(y_bottom * h))
    return im.crop((0, y1, w, y2))

# ---------- 3) Grade a question (student imgs + solution imgs) ----------
def grade_question_images(
    q_idx: int,
    student_imgs: List[str],
    solution_imgs: List[str],
    max_points: float
) -> Dict[str, Any]:
    """
    Send ≤10 images for the student's Q{q_idx} and the solution reference images.
    Returns {points, feedback:{rationale,strengths,missing}}
    """
    # Respect cap
    s_chunks = [student_imgs[i:i+settings.MAX_IMAGES_PER_CALL]
                for i in range(0, len(student_imgs), settings.MAX_IMAGES_PER_CALL)]
    sol_payload = [{"type":"image_url","image_url":{"url":_img_to_data_url(p)}} for p in solution_imgs]

    points_acc = 0.0
    rationale_parts: List[str] = []
    strengths: List[str] = []
    missing: List[str] = []

    for chunk in s_chunks:
        msgs = [
            {"role":"system","content":(
                "You are an auto-grader for STEM exams. "
                "Compare the student's images to the official solution images. "
                "Award partial credit for correct steps even if final value differs. Return STRICT JSON."
            )},
            {"role":"user","content":[
                {"type":"text","text":(
                    f"Grade *Question {q_idx}* only. Max points: {max_points}.\n"
                    "Return JSON with:\n{\n  \"points\": number 0..Max,\n"
                    "  \"rationale\": \"short\",\n"
                    "  \"strengths\": [\"kw\",...],\n"
                    "  \"missing\": [\"kw\",...]\n}\n"
                    "Only evaluate relevant steps; ignore other pages/questions."
                )},
                {"type":"text","text":"Official solution images:"},
                *sol_payload,
                {"type":"text","text":"Student images for this question:"},
                *[{"type":"image_url","image_url":{"url":_img_to_data_url(p)}} for p in chunk]
            ]}
        ]
        out = _vision_call_json(msgs) or {}
        # Accumulate — average rationales; points: take max over chunks or sum capped at max_points.
        pts = float(out.get("points", 0) or 0)
        points_acc = max(points_acc, pts)  # safer than sum if chunks are split views
        r = str(out.get("rationale","")).strip()
        if r: rationale_parts.append(r)
        strengths += list(out.get("strengths", []) or [])
        missing += list(out.get("missing", []) or [])

    points_acc = max(0.0, min(max_points, points_acc))
    return {
        "points": round(points_acc, 2),
        "feedback": {
            "rationale": " ".join(rationale_parts)[:1000] if rationale_parts else "",
            "strengths": strengths[:10],
            "missing": missing[:10],
        }
    }
