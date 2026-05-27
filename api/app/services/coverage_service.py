"""Coverage / topic readiness mapping.

Combines per-obligation topic lists with the user's QuizAttempt history to
produce a readiness percentage per topic and an aggregate readiness per
obligation. Surfaces gaps (topics with no quiz coverage yet) so the
student knows what to study before the deadline.
"""

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Iterable

from sqlalchemy.orm import Session

from app.db.models import CourseObligation, NotebookCard, QuizAttempt


# Weight newer attempts more heavily. Half-life of ~14 days keeps stale
# scores from misrepresenting current readiness without ignoring older work.
_RECENCY_HALF_LIFE_DAYS = 14
_LOOKBACK_DAYS = 90


def _topic_norm(value) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = value.strip().lower()
    return cleaned or None


def _normalize_topics(values) -> list[str]:
    if not isinstance(values, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for v in values:
        n = _topic_norm(v)
        if not n or n in seen:
            continue
        seen.add(n)
        out.append(n)
    return out


def _weight_for_attempt(created_at: str, today: date) -> float:
    try:
        # Strip Z if present, normalize to UTC.
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except ValueError:
        return 1.0
    age_days = max(0, (today - dt.date()).days)
    if age_days > _LOOKBACK_DAYS:
        return 0.0
    return 0.5 ** (age_days / _RECENCY_HALF_LIFE_DAYS)


def compute_obligation_readiness(
    db: Session,
    *,
    obligation: CourseObligation,
    user_id: str,
) -> dict:
    """Return per-topic readiness + obligation aggregate for one obligation.

    Schema:
    {
      "obligation_id": str,
      "topics": [
        {
          "topic": str,
          "attempts_weighted": float,
          "correct_weighted": float,
          "readiness_percent": int | null,
          "cards_due": int,
          "cards_total": int,
          "coverage": "untested" | "weak" | "developing" | "strong",
        },
        ...
      ],
      "overall_readiness_percent": int | null,
      "topics_total": int,
      "topics_untested": int,
    }
    """
    today = date.today()
    topics = _normalize_topics(obligation.topics)

    # Pull recent attempts for this project.
    cutoff_iso = (today - timedelta(days=_LOOKBACK_DAYS)).isoformat()
    attempts = (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.user_id == user_id,
            QuizAttempt.project_id == obligation.project_id,
            QuizAttempt.created_at >= cutoff_iso,
        )
        .all()
    )

    # Group quiz results by topic with recency weighting.
    weighted_attempts: dict[str, float] = defaultdict(float)
    weighted_correct: dict[str, float] = defaultdict(float)
    for attempt in attempts:
        weight = _weight_for_attempt(attempt.created_at, today)
        if weight <= 0:
            continue
        results = attempt.results or []
        for result in results:
            if not isinstance(result, dict):
                continue
            t = _topic_norm(result.get("topic"))
            if not t:
                continue
            weighted_attempts[t] += weight
            if result.get("is_correct"):
                weighted_correct[t] += weight

    # Pull related notebook cards (for "cards due" context).
    today_iso = today.isoformat()
    cards = (
        db.query(NotebookCard)
        .filter(
            NotebookCard.user_id == user_id,
            NotebookCard.project_id == obligation.project_id,
        )
        .all()
    )
    cards_by_topic_total: dict[str, int] = defaultdict(int)
    cards_by_topic_due: dict[str, int] = defaultdict(int)
    for card in cards:
        if not card.tags:
            continue
        for ct in card.tags:
            n = _topic_norm(ct)
            if not n:
                continue
            cards_by_topic_total[n] += 1
            if card.due_date is None or card.due_date <= today_iso:
                cards_by_topic_due[n] += 1

    topic_rows: list[dict] = []
    weighted_sum_attempts = 0.0
    weighted_sum_correct = 0.0
    untested_topics = 0
    for topic in topics:
        attempts_w = weighted_attempts.get(topic, 0.0)
        correct_w = weighted_correct.get(topic, 0.0)
        if attempts_w > 0:
            readiness = round((correct_w / attempts_w) * 100)
            if readiness >= 80:
                coverage = "strong"
            elif readiness >= 50:
                coverage = "developing"
            else:
                coverage = "weak"
        else:
            readiness = None
            coverage = "untested"
            untested_topics += 1
        weighted_sum_attempts += attempts_w
        weighted_sum_correct += correct_w
        topic_rows.append(
            {
                "topic": topic,
                "attempts_weighted": round(attempts_w, 3),
                "correct_weighted": round(correct_w, 3),
                "readiness_percent": readiness,
                "cards_due": cards_by_topic_due.get(topic, 0),
                "cards_total": cards_by_topic_total.get(topic, 0),
                "coverage": coverage,
            }
        )

    if weighted_sum_attempts > 0:
        overall = round((weighted_sum_correct / weighted_sum_attempts) * 100)
    else:
        overall = None

    return {
        "obligation_id": obligation.id,
        "topics": topic_rows,
        "overall_readiness_percent": overall,
        "topics_total": len(topics),
        "topics_untested": untested_topics,
    }


def compute_project_coverage(
    db: Session,
    *,
    project_id: str,
    user_id: str,
) -> dict:
    """Aggregate coverage across all upcoming confirmed obligations in a project."""
    today_iso = date.today().isoformat()
    obligations = (
        db.query(CourseObligation)
        .filter(
            CourseObligation.project_id == project_id,
            CourseObligation.status == "confirmed",
        )
        .all()
    )

    upcoming = [
        o for o in obligations if o.due_date is None or o.due_date >= today_iso
    ]

    rows: list[dict] = []
    overall_attempts = 0.0
    overall_correct = 0.0
    total_topics = 0
    total_untested = 0
    today = date.today()
    cutoff_iso = (today - timedelta(days=_LOOKBACK_DAYS)).isoformat()
    attempts = (
        db.query(QuizAttempt)
        .filter(
            QuizAttempt.user_id == user_id,
            QuizAttempt.project_id == project_id,
            QuizAttempt.created_at >= cutoff_iso,
        )
        .all()
    )

    # Precompute weighted attempts/correct by topic once.
    weighted_attempts: dict[str, float] = defaultdict(float)
    weighted_correct: dict[str, float] = defaultdict(float)
    for attempt in attempts:
        weight = _weight_for_attempt(attempt.created_at, today)
        if weight <= 0:
            continue
        for result in attempt.results or []:
            if not isinstance(result, dict):
                continue
            t = _topic_norm(result.get("topic"))
            if not t:
                continue
            weighted_attempts[t] += weight
            if result.get("is_correct"):
                weighted_correct[t] += weight

    for obligation in upcoming:
        topics = _normalize_topics(obligation.topics)
        if not topics:
            rows.append(
                {
                    "obligation_id": obligation.id,
                    "title": obligation.title,
                    "due_date": obligation.due_date,
                    "topics_total": 0,
                    "topics_untested": 0,
                    "overall_readiness_percent": None,
                }
            )
            continue
        attempts_sum = 0.0
        correct_sum = 0.0
        untested = 0
        for topic in topics:
            attempts_w = weighted_attempts.get(topic, 0.0)
            correct_w = weighted_correct.get(topic, 0.0)
            attempts_sum += attempts_w
            correct_sum += correct_w
            if attempts_w == 0:
                untested += 1
        readiness = (
            round((correct_sum / attempts_sum) * 100) if attempts_sum > 0 else None
        )
        rows.append(
            {
                "obligation_id": obligation.id,
                "title": obligation.title,
                "due_date": obligation.due_date,
                "topics_total": len(topics),
                "topics_untested": untested,
                "overall_readiness_percent": readiness,
            }
        )
        overall_attempts += attempts_sum
        overall_correct += correct_sum
        total_topics += len(topics)
        total_untested += untested

    project_readiness = (
        round((overall_correct / overall_attempts) * 100)
        if overall_attempts > 0
        else None
    )

    return {
        "project_id": project_id,
        "obligations": rows,
        "project_readiness_percent": project_readiness,
        "topics_total": total_topics,
        "topics_untested": total_untested,
        "obligations_count": len(upcoming),
    }
