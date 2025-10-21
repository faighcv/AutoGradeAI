from functools import lru_cache
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer
from ..config import settings

@lru_cache(maxsize=1)
def get_embedder():
    return SentenceTransformer(settings.EMBEDDINGS_MODEL)

def semantic_similarity(a: str, b: str) -> float:
    embs = get_embedder().encode([a or "", b or ""], normalize_embeddings=True)
    return float(embs[0] @ embs[1])

def lexical_similarity(a: str, b: str) -> float:
    tfidf = TfidfVectorizer(min_df=1, stop_words="english")
    X = tfidf.fit_transform([(a or ""), (b or "")])
    return float(cosine_similarity(X[0], X[1])[0, 0])

def score_answer(student: str, answer_key: dict, max_points: float) -> dict:
    key_text = (answer_key or {}).get("text", "")
    keywords = set(map(str.lower, (answer_key or {}).get("keywords", [])))
    tokens = set((student or "").lower().split())
    kw_hits = len(keywords & tokens) / max(1, len(keywords)) if keywords else 0.0

    sem = semantic_similarity(student or "", key_text or "")
    lex = lexical_similarity(student or "", key_text or "")
    w1, w2, w3 = 0.3, 0.5, 0.2
    raw = w1 * kw_hits + w2 * sem + w3 * lex
    points = round(max_points * min(1.0, raw), 2)

    feedback = {
        "strengths": [k for k in keywords if k in tokens],
        "missing": [k for k in keywords if k not in tokens],
        "metrics": {"semantic": round(sem,3), "lexical": round(lex,3), "kw": round(kw_hits,3)},
    }
    return {"points": points, "sem": sem, "lex": lex, "feedback": feedback}
