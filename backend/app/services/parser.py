# AUTOGRADEAI/backend/app/services/parser.py
from __future__ import annotations
import re
from typing import Dict, List, Tuple

# Recognize many formats:
# Q1 / Question 1 / 1) / 1. / 1 - / I) / I. / Part 1
QUESTION_SPLIT = re.compile(
    r"(?:^|\n)\s*(?:Q(?:uestion)?|Part)?\s*"
    r"((?:[IVXLCDM]+)|(?:\d+))\s*(?:[\)\.\:\-]+|\s)",  # roman or arabic
    re.IGNORECASE,
)

def _roman_to_int(s: str) -> int | None:
    s = s.upper()
    vals = dict(I=1, V=5, X=10, L=50, C=100, D=500, M=1000)
    total = 0
    prev = 0
    for ch in reversed(s):
        if ch not in vals: return None
        v = vals[ch]
        if v < prev: total -= v
        else: total += v; prev = v
    return total if total > 0 else None

def _to_idx(tok: str) -> int:
    tok = (tok or "").strip()
    if tok.isdigit(): return int(tok)
    r = _roman_to_int(tok)
    return r if r is not None else -1

def split_answers_by_question(text: str) -> Dict[int, str]:
    """
    Split long text into per-question answers using robust heuristics.
    Returns ordered {idx: text}. If no markers found, returns {1: full_text}.
    """
    text = text or ""
    matches: List[Tuple[int, int, int]] = []  # (qnum, start, end)
    tokens = list(QUESTION_SPLIT.finditer(text))
    if not tokens:
        return {1: text.strip()}

    for i, m in enumerate(tokens):
        tok = m.group(1)
        qnum = _to_idx(tok)
        if qnum <= 0:  # ignore junk markers
            continue
        start = m.start()
        end = tokens[i + 1].start() if i + 1 < len(tokens) else len(text)
        matches.append((qnum, start, end))

    if not matches:
        return {1: text.strip()}

    out: Dict[int, str] = {}
    for (qnum, start, end) in matches:
        chunk = text[start:end].strip()
        # Remove leading marker inside chunk once
        chunk = QUESTION_SPLIT.sub("", chunk, count=1).strip()
        if chunk:
            out[qnum] = chunk
    return out or {1: text.strip()}

def comma_keywords(s: str) -> List[str]:
    return [x.strip() for x in (s or "").split(",") if x.strip()]
