from functools import lru_cache
from itertools import combinations
from typing import List, Dict
from sentence_transformers import SentenceTransformer
from ..config import settings

@lru_cache(maxsize=1)
def get_embedder():
    return SentenceTransformer(settings.EMBEDDINGS_MODEL)

def _jacc(a: str, b: str) -> float:
    A, B = set((a or "").split()), set((b or "").split())
    denom = len(A | B) or 1
    return len(A & B) / denom

def flag_pairs(answers: List[Dict], thresh_sem: float, thresh_jacc: float):
    texts = [x.get("text", "") for x in answers]
    if len(texts) < 2:
        return []
    embs = get_embedder().encode(texts, normalize_embeddings=True)
    flags = []
    for (i, j) in combinations(range(len(answers)), 2):
        sem = float(embs[i] @ embs[j])
        if sem < thresh_sem:
            continue
        jacc = _jacc(texts[i], texts[j])
        if jacc >= thresh_jacc:
            flags.append({
                "submission_a": answers[i]["submission_id"],
                "submission_b": answers[j]["submission_id"],
                "sem": sem, "jacc": jacc
            })
    return flags
