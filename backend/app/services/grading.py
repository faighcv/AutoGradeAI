from .grading_llm import grade_answer_with_openai

def score_answer(student: str, answer_key: dict, max_points: float, question_prompt: str = "") -> dict:
    """
    Grade a single answer using OpenAI with both the question prompt and the answer key.
    """
    key_text = (answer_key or {}).get("text", "")
    return grade_answer_with_openai(student or "", question_prompt or "", key_text or "", max_points)
