"""Grader behavior for the three-state mock-exam verdict (Phase D2).

Free-text answers the grader can't auto-confirm must land on "unverified" (for
student self-grade) rather than being hard-marked wrong, and scoring must be
computed over verified items only.
"""

from app.services.mock_exam_service import _grade_answer, _summarize_verdicts


def _q(qid, qtype, answer, topic="General"):
    return {"id": qid, "type": qtype, "topic": topic, "prompt": "p", "answer": answer}


def test_mcq_is_deterministic():
    q = _q("1", "mcq", "Paris")
    assert _grade_answer(q, "Paris") == "correct"
    assert _grade_answer(q, "London") == "incorrect"


def test_blank_answer_is_incorrect():
    assert _grade_answer(_q("1", "short_answer", "anything"), "") == "incorrect"
    assert _grade_answer(_q("2", "fill_blank", "mitochondria"), "   ") == "incorrect"


def test_free_text_exact_match_is_correct():
    assert _grade_answer(_q("1", "fill_blank", "Mitochondria"), "mitochondria") == "correct"


def test_free_text_paraphrase_is_unverified_not_wrong():
    # Substring/paraphrase used to be auto-marked; now it must defer to self-grade.
    q = _q("1", "short_answer", "because of photosynthesis")
    assert _grade_answer(q, "plants make energy via photosynthesis") == "unverified"


def test_score_is_over_verified_items_only():
    questions = [
        _q("1", "mcq", "a", topic="A"),
        _q("2", "mcq", "b", topic="A"),
        _q("3", "short_answer", "x", topic="B"),
    ]
    verdicts = {"1": "correct", "2": "incorrect", "3": "unverified"}
    summary = _summarize_verdicts(questions, verdicts)
    assert summary["correct_count"] == 1
    assert summary["incorrect_count"] == 1
    assert summary["unverified_count"] == 1
    # 1 correct / 2 verified == 50% (the unverified item is excluded).
    assert summary["score_percent"] == 50
    topic_a = next(t for t in summary["per_topic"] if t["topic"] == "A")
    assert topic_a["total"] == 2 and topic_a["correct"] == 1
    # Topic B had only an unverified item, so it doesn't appear in accuracy.
    assert all(t["topic"] != "B" for t in summary["per_topic"])
