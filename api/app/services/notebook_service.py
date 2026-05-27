"""Helpers for seeding notebook cards from external sources (quiz gaps, etc.)."""

import logging
from datetime import date
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.utils import utc_now_iso
from app.db.models import NotebookCard

logger = logging.getLogger(__name__)


def seed_remedial_cards_from_quiz_results(
    db: Session,
    *,
    user_id: str,
    project_id: str,
    results: list[dict],
) -> int:
    """Create one quiz_gap notebook card per missed question.

    The front holds the question, the back combines the correct answer and
    rationale, and topic (if present) seeds the tag list.

    De-duplicates against existing quiz_gap cards in the same project that
    already have the same front text — so retrying a quiz with the same
    questions does not flood the deck.
    """
    if not results:
        return 0
    today_iso = date.today().isoformat()
    now = utc_now_iso()

    existing_fronts: set[str] = {
        row.front
        for row in db.query(NotebookCard.front)
        .filter(
            NotebookCard.user_id == user_id,
            NotebookCard.project_id == project_id,
            NotebookCard.origin == "quiz_gap",
        )
        .all()
    }

    created = 0
    for result in results:
        if not isinstance(result, dict):
            continue
        if result.get("is_correct"):
            continue
        question = str(result.get("question") or "").strip()
        if not question:
            continue
        front_text = question[:4000]
        if front_text in existing_fronts:
            continue

        correct_answer = str(result.get("correct_answer") or "").strip()
        rationale = str(result.get("rationale") or "").strip()
        back_parts: list[str] = []
        if correct_answer:
            back_parts.append(f"Correct answer: {correct_answer}")
        if rationale:
            back_parts.append(rationale)
        back_text = "\n\n".join(back_parts)[:8000] or None

        topic = result.get("topic")
        tags: list[str] | None = None
        if isinstance(topic, str) and topic.strip():
            tags = [topic.strip().lower()[:30]]

        card = NotebookCard(
            id=str(uuid4()),
            user_id=user_id,
            project_id=project_id,
            source_stream_entry_id=None,
            origin="quiz_gap",
            front=front_text,
            back=back_text,
            tags=tags,
            ease_factor=2.5,
            interval_days=0,
            repetitions=0,
            due_date=today_iso,
            last_reviewed_at=None,
            last_quality=None,
            created_at=now,
            updated_at=now,
        )
        db.add(card)
        existing_fronts.add(front_text)
        created += 1

    if created:
        logger.info(
            "Seeded %d remedial notebook card(s) from quiz gaps for project=%s",
            created,
            project_id,
        )
    return created
