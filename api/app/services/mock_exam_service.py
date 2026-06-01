"""Phase I — timed mock exam construction and grading.

Builds an exam by sampling existing reviewer quiz items (and flashcards) for a
project, weighted by:
  * the obligation's topic_weights (Phase G1)
  * a weak-topic bias derived from recent QuizAttempt results

On submission, grades each item, computes per-topic accuracy, and seeds
remedial NotebookCards for items the student got wrong (Phase I6).
"""

from __future__ import annotations

import logging
import random
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.utils import utc_now_iso
from app.db.models import (
    CourseObligation,
    MockExamSession,
    NotebookCard,
    QuizAttempt,
    Reviewer,
)

logger = logging.getLogger(__name__)


DIFFICULTY_TO_TYPE_WEIGHTS = {
    "easy": {"mcq": 0.7, "fill_blank": 0.2, "short_answer": 0.1},
    "medium": {"mcq": 0.5, "fill_blank": 0.25, "short_answer": 0.25},
    "hard": {"mcq": 0.3, "fill_blank": 0.3, "short_answer": 0.4},
    "mixed": {"mcq": 0.5, "fill_blank": 0.25, "short_answer": 0.25},
}


def _normalize_topic(value: str | None) -> str:
    if not value:
        return "General"
    cleaned = str(value).strip()
    return cleaned[:80] if cleaned else "General"


def _normalize_answer(value: str) -> str:
    return re.sub(r"\s+", " ", str(value).strip().lower())


def _gather_reviewer_pool(db: Session, project_id: str) -> tuple[list[dict], list[dict]]:
    """Return (quiz_items, flashcards) aggregated across the project's reviewers."""
    reviewers = (
        db.query(Reviewer)
        .filter(Reviewer.project_id == project_id, Reviewer.status == "ready")
        .all()
    )
    quiz_items: list[dict] = []
    flashcards: list[dict] = []
    for rev in reviewers:
        content = rev.content_json or {}
        for item in content.get("quiz") or []:
            if not isinstance(item, dict):
                continue
            question = (item.get("question") or "").strip()
            answer = (item.get("answer") or "").strip()
            if not question or not answer:
                continue
            quiz_items.append(
                {
                    "topic": _normalize_topic(item.get("topic")),
                    "question": question,
                    "choices": [str(c) for c in (item.get("choices") or []) if c],
                    "answer": answer,
                    "rationale": (item.get("rationale") or "").strip() or None,
                }
            )
        for fc in content.get("flashcards") or []:
            if not isinstance(fc, dict):
                continue
            front = (fc.get("front") or "").strip()
            back = (fc.get("back") or "").strip()
            if not front or not back:
                continue
            flashcards.append(
                {
                    "topic": _normalize_topic(fc.get("topic")),
                    "front": front,
                    "back": back,
                }
            )
    return quiz_items, flashcards


def _weak_topic_bias(db: Session, project_id: str) -> dict[str, float]:
    """Higher values = student has struggled with this topic recently."""
    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.project_id == project_id)
        .order_by(QuizAttempt.created_at.desc())
        .limit(10)
        .all()
    )
    totals: dict[str, list[int]] = defaultdict(lambda: [0, 0])  # [correct, total]
    for attempt in attempts:
        for item in attempt.results or []:
            if not isinstance(item, dict):
                continue
            topic = _normalize_topic(item.get("topic"))
            totals[topic][1] += 1
            if item.get("correct"):
                totals[topic][0] += 1
    bias: dict[str, float] = {}
    for topic, (correct, total) in totals.items():
        if total <= 0:
            continue
        accuracy = correct / total
        bias[topic] = max(0.0, 1.0 - accuracy)
    return bias


def _select_question_topic(
    topic: str, difficulty_mode: str, rng: random.Random
) -> str:
    """Pick mcq / fill_blank / short_answer for one slot honoring difficulty mix."""
    weights = DIFFICULTY_TO_TYPE_WEIGHTS.get(difficulty_mode, DIFFICULTY_TO_TYPE_WEIGHTS["mixed"])
    types = list(weights.keys())
    return rng.choices(types, weights=[weights[t] for t in types], k=1)[0]


def _make_fill_blank(question: str, answer: str) -> tuple[str, str] | None:
    """Turn a Q/A pair into a fill-in-the-blank style item if the answer
    surface form appears inside the question text. Returns (prompt, answer)
    or None if not feasible."""
    if len(answer) < 2 or len(answer) > 60:
        return None
    pattern = re.compile(re.escape(answer), re.IGNORECASE)
    blanked, n = pattern.subn("_____", question, count=1)
    if n == 0:
        return None
    return blanked, answer


def _build_items(
    quiz_pool: list[dict],
    flashcards: list[dict],
    *,
    target_count: int,
    topic_weights: dict[str, float],
    weak_bias: dict[str, float],
    difficulty: str,
    rng: random.Random,
) -> list[dict]:
    """Sample `target_count` items, prioritizing weighted + weak topics.

    Source order: quiz items (true MCQs / short-answer) first, then derive
    fill-in-the-blank items from flashcards if more are needed."""
    has_weights = any(v > 0 for v in topic_weights.values())

    def topic_score(topic: str) -> float:
        weight = topic_weights.get(topic, 0.0) if has_weights else 1.0
        bias = weak_bias.get(topic, 0.3)  # neutral default — slightly biased
        # Add 0.05 so untouched topics aren't completely starved.
        return max(0.05, weight * (0.4 + 0.6 * bias))

    weighted_pool: list[tuple[dict, float]] = [
        (item, topic_score(item["topic"])) for item in quiz_pool
    ]
    weighted_pool = [pair for pair in weighted_pool if pair[1] > 0]

    selected: list[dict] = []
    seen_questions: set[str] = set()

    # First pass: sample from the reviewer quiz items.
    if weighted_pool:
        attempts = 0
        while len(selected) < target_count and attempts < target_count * 6 and weighted_pool:
            attempts += 1
            item = rng.choices(
                [p[0] for p in weighted_pool],
                weights=[p[1] for p in weighted_pool],
                k=1,
            )[0]
            key = item["question"].lower()
            if key in seen_questions:
                continue
            seen_questions.add(key)
            # Decide format for this slot.
            chosen_type = _select_question_topic(item["topic"], difficulty, rng)
            if chosen_type == "mcq" and len(item["choices"]) >= 2:
                choices = list(item["choices"])
                rng.shuffle(choices)
                selected.append(
                    {
                        "id": f"q-{uuid4().hex[:10]}",
                        "type": "mcq",
                        "topic": item["topic"],
                        "prompt": item["question"],
                        "choices": choices,
                        "answer": item["answer"],
                        "rationale": item.get("rationale"),
                        "difficulty": "medium" if difficulty == "mixed" else difficulty,
                    }
                )
            elif chosen_type == "fill_blank":
                blank = _make_fill_blank(item["question"], item["answer"])
                if blank:
                    prompt, answer = blank
                    selected.append(
                        {
                            "id": f"q-{uuid4().hex[:10]}",
                            "type": "fill_blank",
                            "topic": item["topic"],
                            "prompt": prompt,
                            "choices": [],
                            "answer": answer,
                            "rationale": item.get("rationale"),
                            "difficulty": "medium" if difficulty == "mixed" else difficulty,
                        }
                    )
                else:
                    selected.append(
                        {
                            "id": f"q-{uuid4().hex[:10]}",
                            "type": "short_answer",
                            "topic": item["topic"],
                            "prompt": item["question"],
                            "choices": [],
                            "answer": item["answer"],
                            "rationale": item.get("rationale"),
                            "difficulty": "medium" if difficulty == "mixed" else difficulty,
                        }
                    )
            else:
                selected.append(
                    {
                        "id": f"q-{uuid4().hex[:10]}",
                        "type": "short_answer",
                        "topic": item["topic"],
                        "prompt": item["question"],
                        "choices": [],
                        "answer": item["answer"],
                        "rationale": item.get("rationale"),
                        "difficulty": "medium" if difficulty == "mixed" else difficulty,
                    }
                )

    # Second pass: top up from flashcards as short-answer items.
    if len(selected) < target_count and flashcards:
        fc_pool = list(flashcards)
        rng.shuffle(fc_pool)
        for fc in fc_pool:
            if len(selected) >= target_count:
                break
            key = fc["front"].lower()
            if key in seen_questions:
                continue
            seen_questions.add(key)
            selected.append(
                {
                    "id": f"q-{uuid4().hex[:10]}",
                    "type": "short_answer",
                    "topic": fc["topic"],
                    "prompt": fc["front"],
                    "choices": [],
                    "answer": fc["back"],
                    "rationale": None,
                    "difficulty": "medium" if difficulty == "mixed" else difficulty,
                }
            )

    return selected


def build_exam_session(
    db: Session,
    *,
    project_id: str,
    user_id: str,
    obligation_id: str | None,
    title: str | None,
    difficulty: str,
    target_minutes: int,
    question_count: int,
    confidence_before: int | None,
) -> MockExamSession:
    """Create and persist a new MockExamSession row.

    Raises ValueError if there is not enough source material for at least 3
    questions — the UI should redirect the student to add reviewer content."""
    quiz_pool, flashcards = _gather_reviewer_pool(db, project_id)
    if len(quiz_pool) + len(flashcards) < 3:
        raise ValueError(
            "Not enough reviewer material to build an exam. "
            "Generate reviewers for at least one source first."
        )

    obligation: CourseObligation | None = None
    if obligation_id:
        obligation = db.get(CourseObligation, obligation_id)
        if not obligation or obligation.project_id != project_id:
            raise ValueError("Obligation not found")

    topic_weights = obligation.topic_weights if obligation else {}
    if not isinstance(topic_weights, dict):
        topic_weights = {}
    # Normalize keys
    topic_weights = {
        _normalize_topic(k): float(v) for k, v in topic_weights.items()
    }

    weak_bias = _weak_topic_bias(db, project_id)
    rng = random.Random()

    questions = _build_items(
        quiz_pool,
        flashcards,
        target_count=question_count,
        topic_weights=topic_weights,
        weak_bias=weak_bias,
        difficulty=difficulty,
        rng=rng,
    )
    if len(questions) < 3:
        raise ValueError(
            "Could not assemble enough exam questions from your reviewer material."
        )

    now_dt = datetime.now(timezone.utc)
    started_at = now_dt.isoformat().replace("+00:00", "Z")
    deadline_at = (now_dt + timedelta(minutes=target_minutes)).isoformat().replace("+00:00", "Z")

    if not title:
        if obligation:
            title = f"Mock exam — {obligation.title}"
        else:
            title = f"Mock exam — {now_dt.strftime('%b %d, %Y')}"

    now = utc_now_iso()
    session = MockExamSession(
        id=str(uuid4()),
        project_id=project_id,
        user_id=user_id,
        obligation_id=obligation_id,
        title=title[:200],
        difficulty=difficulty,
        target_minutes=target_minutes,
        question_count=question_count,
        questions=questions,
        answers={},
        per_topic_results=None,
        correct_count=None,
        total_count=len(questions),
        score_percent=None,
        started_at=started_at,
        deadline_at=deadline_at,
        submitted_at=None,
        status="in_progress",
        confidence_before=confidence_before,
        confidence_after=None,
        created_at=now,
        updated_at=now,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


VERDICT_CORRECT = "correct"
VERDICT_INCORRECT = "incorrect"
VERDICT_UNVERIFIED = "unverified"


def _grade_answer(question: dict, given: str) -> str:
    """Return a three-state verdict for one answer.

    MCQ is deterministic (the choice either matches or it doesn't). Free-text
    (fill_blank / short_answer) only auto-confirms an exact normalized match;
    anything else is left "unverified" for the student to self-grade rather than
    being hard-marked wrong on a brittle substring heuristic.
    """
    user = _normalize_answer(given)
    if not user:
        return VERDICT_INCORRECT
    expected = _normalize_answer(question.get("answer", ""))
    if question["type"] == "mcq":
        # No expected answer recorded → we can't auto-decide an MCQ either.
        if not expected:
            return VERDICT_UNVERIFIED
        return VERDICT_CORRECT if user == expected else VERDICT_INCORRECT
    if expected and user == expected:
        return VERDICT_CORRECT
    return VERDICT_UNVERIFIED


def _seed_remedial_cards(
    db: Session,
    *,
    project_id: str,
    user_id: str,
    missed_items: list[dict],
) -> int:
    if not missed_items:
        return 0
    now = utc_now_iso()
    today = now.split("T", 1)[0]
    existing_fronts = {
        (front or "").strip().lower()
        for (front,) in db.query(NotebookCard.front)
        .filter(NotebookCard.project_id == project_id, NotebookCard.user_id == user_id)
        .all()
    }
    created = 0
    for item in missed_items:
        front = item["prompt"]
        if not front:
            continue
        key = front.strip().lower()
        if key in existing_fronts:
            continue
        existing_fronts.add(key)
        db.add(
            NotebookCard(
                id=str(uuid4()),
                user_id=user_id,
                project_id=project_id,
                source_stream_entry_id=None,
                source_audio_entry_id=None,
                origin="quiz_gap",
                front=front,
                back=item.get("answer") or "",
                tags=[item["topic"]] if item.get("topic") else [],
                ease_factor=2.5,
                interval_days=0,
                repetitions=0,
                due_date=today,
                last_reviewed_at=None,
                last_quality=None,
                created_at=now,
                updated_at=now,
            )
        )
        created += 1
    if created:
        db.commit()
    return created


def _summarize_verdicts(
    questions: list[dict], verdicts: dict[str, str]
) -> dict[str, Any]:
    """Roll a verdict map up into topic accuracy + counts.

    Scoring is over *verified* items only (correct + incorrect); "unverified"
    free-text answers are excluded from the denominator so an exam we couldn't
    fully auto-grade doesn't read as a low score.
    """
    topic_totals: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    correct_count = 0
    incorrect_count = 0
    unverified_count = 0
    for question in questions:
        verdict = verdicts.get(question["id"], VERDICT_UNVERIFIED)
        topic = _normalize_topic(question.get("topic"))
        if verdict == VERDICT_CORRECT:
            correct_count += 1
            topic_totals[topic][0] += 1
            topic_totals[topic][1] += 1
        elif verdict == VERDICT_INCORRECT:
            incorrect_count += 1
            topic_totals[topic][1] += 1
        else:
            unverified_count += 1
    verified = correct_count + incorrect_count
    score_percent = int(round(100 * correct_count / verified)) if verified else 0
    per_topic = [
        {
            "topic": topic,
            "correct": tally[0],
            "total": tally[1],
            "accuracy_percent": int(round(100 * tally[0] / tally[1])) if tally[1] else 0,
        }
        for topic, tally in sorted(topic_totals.items())
    ]
    return {
        "per_topic": per_topic,
        "correct_count": correct_count,
        "incorrect_count": incorrect_count,
        "unverified_count": unverified_count,
        "score_percent": score_percent,
    }


def grade_exam(
    db: Session,
    session: MockExamSession,
    *,
    answers: dict[str, str],
    confidence_after: int | None,
) -> tuple[MockExamSession, dict[str, str], int]:
    """Grade an exam, persist results, and seed remedial cards.

    Returns (refreshed session, per_question_verdict map, remedial_cards_created).
    """
    if session.status != "in_progress":
        raise ValueError("Exam is no longer in progress")
    questions: list[dict] = list(session.questions or [])
    by_id = {q["id"]: q for q in questions}
    verdicts: dict[str, str] = {
        q["id"]: _grade_answer(q, (answers.get(q["id"]) or "").strip())
        for q in questions
    }
    summary = _summarize_verdicts(questions, verdicts)
    # Only seed remedial cards for definitively-incorrect items — never for
    # answers we simply couldn't auto-verify.
    missed = [q for q in questions if verdicts.get(q["id"]) == VERDICT_INCORRECT]

    session.answers = {qid: answers.get(qid, "") for qid in by_id}
    session.per_question_results = verdicts
    session.per_topic_results = summary["per_topic"]
    session.correct_count = summary["correct_count"]
    session.score_percent = summary["score_percent"]
    session.submitted_at = utc_now_iso()
    session.status = "submitted"
    session.confidence_after = confidence_after
    session.updated_at = session.submitted_at
    db.commit()

    _record_quiz_attempt(db, session, questions, verdicts, summary)

    remedial = _seed_remedial_cards(
        db,
        project_id=session.project_id,
        user_id=session.user_id,
        missed_items=missed,
    )

    db.refresh(session)
    return session, verdicts, remedial


def _record_quiz_attempt(
    db: Session,
    session: MockExamSession,
    questions: list[dict],
    verdicts: dict[str, str],
    summary: dict[str, Any],
) -> None:
    """Record a QuizAttempt-style row so existing dashboards see this exam."""
    try:
        db.add(
            QuizAttempt(
                id=str(uuid4()),
                user_id=session.user_id,
                project_id=session.project_id,
                reviewer_version=0,
                results=[
                    {
                        "topic": q["topic"],
                        "correct": verdicts.get(q["id"]) == VERDICT_CORRECT,
                        "question": q["prompt"],
                    }
                    for q in questions
                ],
                total_questions=len(questions),
                correct_answers=summary["correct_count"],
                score_percent=summary["score_percent"],
                duration_seconds=None,
                confidence_before=session.confidence_before,
                confidence_after=session.confidence_after,
                created_at=session.submitted_at,
            )
        )
        db.commit()
    except Exception:
        logger.exception("Could not record QuizAttempt from MockExamSession")
        db.rollback()


def self_grade_answer(
    db: Session,
    session: MockExamSession,
    *,
    question_id: str,
    verdict: str,
) -> tuple[MockExamSession, dict[str, str], int]:
    """Resolve one previously-unverified answer with the student's own verdict.

    Recomputes score/topic accuracy and, if newly marked incorrect, seeds a
    remedial card for that single item.
    """
    if session.status != "submitted":
        raise ValueError("Exam is not in a graded state")
    if verdict not in (VERDICT_CORRECT, VERDICT_INCORRECT):
        raise ValueError("verdict must be 'correct' or 'incorrect'")
    questions: list[dict] = list(session.questions or [])
    by_id = {q["id"]: q for q in questions}
    if question_id not in by_id:
        raise ValueError("Question not found in this exam")

    verdicts: dict[str, str] = dict(session.per_question_results or {})
    previous = verdicts.get(question_id)
    verdicts[question_id] = verdict
    summary = _summarize_verdicts(questions, verdicts)

    session.per_question_results = verdicts
    session.per_topic_results = summary["per_topic"]
    session.correct_count = summary["correct_count"]
    session.score_percent = summary["score_percent"]
    session.updated_at = utc_now_iso()
    db.commit()

    remedial = 0
    if verdict == VERDICT_INCORRECT and previous != VERDICT_INCORRECT:
        remedial = _seed_remedial_cards(
            db,
            project_id=session.project_id,
            user_id=session.user_id,
            missed_items=[by_id[question_id]],
        )

    db.refresh(session)
    return session, verdicts, remedial


def session_to_in_progress_dict(session: MockExamSession) -> dict[str, Any]:
    """Strip per-question answers from a still-running exam."""
    safe_questions = []
    for q in session.questions or []:
        safe = dict(q)
        safe.pop("answer", None)
        safe.pop("rationale", None)
        safe_questions.append(safe)
    return {
        "id": session.id,
        "project_id": session.project_id,
        "obligation_id": session.obligation_id,
        "title": session.title,
        "difficulty": session.difficulty,
        "target_minutes": session.target_minutes,
        "question_count": session.question_count,
        "total_count": session.total_count,
        "correct_count": session.correct_count,
        "score_percent": session.score_percent,
        "started_at": session.started_at,
        "deadline_at": session.deadline_at,
        "submitted_at": session.submitted_at,
        "status": session.status,
        "confidence_before": session.confidence_before,
        "confidence_after": session.confidence_after,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "questions": safe_questions,
        "answers": session.answers or {},
        "per_topic_results": session.per_topic_results or [],
    }


def session_to_graded_dict(
    session: MockExamSession,
    per_question: dict[str, str] | None = None,
    remedial: int = 0,
) -> dict[str, Any]:
    # Fall back to the persisted verdicts so a re-fetched graded exam keeps its
    # per-question state (the live /submit payload passes them in directly).
    verdicts: dict[str, str] = dict(per_question or session.per_question_results or {})
    per_question_correct = {
        qid: (verdict == VERDICT_CORRECT) for qid, verdict in verdicts.items()
    }
    unverified_count = sum(1 for v in verdicts.values() if v == VERDICT_UNVERIFIED)
    return {
        "id": session.id,
        "project_id": session.project_id,
        "obligation_id": session.obligation_id,
        "title": session.title,
        "difficulty": session.difficulty,
        "target_minutes": session.target_minutes,
        "question_count": session.question_count,
        "total_count": session.total_count,
        "correct_count": session.correct_count,
        "score_percent": session.score_percent,
        "started_at": session.started_at,
        "deadline_at": session.deadline_at,
        "submitted_at": session.submitted_at,
        "status": session.status,
        "confidence_before": session.confidence_before,
        "confidence_after": session.confidence_after,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "questions": list(session.questions or []),
        "answers": session.answers or {},
        "per_question_correct": per_question_correct,
        "per_question_verdict": verdicts,
        "unverified_count": unverified_count,
        "per_topic_results": session.per_topic_results or [],
        "remedial_cards_created": remedial,
    }


def session_to_summary_dict(session: MockExamSession) -> dict[str, Any]:
    return {
        "id": session.id,
        "project_id": session.project_id,
        "obligation_id": session.obligation_id,
        "title": session.title,
        "difficulty": session.difficulty,
        "target_minutes": session.target_minutes,
        "question_count": session.question_count,
        "total_count": session.total_count,
        "correct_count": session.correct_count,
        "score_percent": session.score_percent,
        "started_at": session.started_at,
        "deadline_at": session.deadline_at,
        "submitted_at": session.submitted_at,
        "status": session.status,
        "confidence_before": session.confidence_before,
        "confidence_after": session.confidence_after,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
    }
