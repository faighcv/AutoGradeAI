# AUTOGRADEAI/backend/app/services/parser.py
from __future__ import annotations
import re
from typing import Dict, List, Tuple

QUESTION_SPLIT = re.compile(
    r"(?:^|\n)\s*(?:Q(?:uestion)?\s*)?(\d+)\s*(?:[\)\.\:\-]+|\s)", re.IGNORECASE
)

def split_answers_by_question(text: str) -> Dict[int, str]:
    text = text or ""
    matches = list(QUESTION_SPLIT.finditer(text))
    if not matches:
        return {1: text.strip()}
    spans: List[tuple[int, int, int]] = []
    for i, m in enumerate(matches):
        qnum = int(m.group(1))
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        spans.append((qnum, start, end))
    qmap: Dict[int, str] = {}
    for (qnum, start, end) in spans:
        chunk = text[start:end].strip()
        chunk = QUESTION_SPLIT.sub("", chunk, count=1).strip()
        qmap[qnum] = chunk
    return qmap

def comma_keywords(s: str) -> List[str]:
    return [x.strip() for x in (s or "").split(",") if x.strip()]