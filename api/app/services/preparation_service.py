from collections import defaultdict
from datetime import date, timedelta
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.utils import utc_now_iso
from app.db.models import CourseObligation, CourseTask, PreparationMilestone


# Per-task minute estimates used when budgeting milestone load against existing
# student tasks. CourseTask does not store estimated minutes, so we approximate
# by priority so that high-priority tasks consume more of the day's budget.
TASK_MINUTES_BY_PRIORITY: dict[str, int] = {
    "high": 60,
    "medium": 30,
    "low": 20,
}


def _task_load_by_day(db: Session, project_id: str) -> dict[str, int]:
    tasks = (
        db.query(CourseTask)
        .filter(
            CourseTask.project_id == project_id,
            CourseTask.status == "open",
            CourseTask.due_date.isnot(None),
        )
        .all()
    )
    load: dict[str, int] = defaultdict(int)
    for task in tasks:
        if not task.due_date:
            continue
        load[task.due_date] += TASK_MINUTES_BY_PRIORITY.get(task.priority, 30)
    return load


MilestoneTemplate = tuple[str, str, int, int]

MILESTONE_TEMPLATES: dict[str, list[MilestoneTemplate]] = {
    "quiz": [
        ("Confirm quiz coverage and collect notes", "materials", 7, 20),
        ("Recall the core concepts without notes", "recall", 4, 30),
        ("Answer practice questions", "practice", 2, 30),
        ("Quick final review", "final_review", 1, 20),
    ],
    "exam": [
        ("Organize exam coverage and course materials", "materials", 14, 30),
        ("Active recall session", "recall", 10, 45),
        ("Practice question session", "practice", 7, 60),
        ("Check weak topics with timed practice", "weak_topics", 3, 60),
        ("Final review and exam logistics", "final_review", 1, 30),
    ],
    "assignment": [
        ("Review requirements and grading criteria", "criteria", 7, 20),
        ("Break the assignment into answer steps", "outline", 5, 30),
        ("Complete a focused work session", "draft", 3, 60),
        ("Revise and check submission requirements", "revision", 1, 30),
    ],
    "project": [
        ("Review project criteria and required outputs", "criteria", 21, 30),
        ("Divide the project into deliverable steps", "breakdown", 18, 45),
        ("Complete a focused build session", "draft", 12, 60),
        ("Run a progress and evidence check", "progress_check", 7, 45),
        ("Revise and check submission requirements", "revision", 2, 60),
    ],
    "paper": [
        ("Review paper question and grading criteria", "criteria", 10, 20),
        ("Build a bounded outline and source list", "outline", 8, 40),
        ("Complete a focused drafting session", "draft", 5, 60),
        ("Revise claims, citations, and format", "revision", 2, 45),
    ],
    "reading": [
        ("Read and annotate the assigned material", "reading", 4, 45),
        ("Write a short recall summary", "recall", 1, 20),
    ],
    "other": [
        ("Clarify the required output", "criteria", 7, 20),
        ("Complete a focused preparation session", "practice", 3, 45),
        ("Final check before the deadline", "final_review", 1, 20),
    ],
}


def _possible_dates(today: date, due_date: date, target_date: date, earliest_date: date) -> list[date]:
    if due_date <= today:
        return [today]
    last_date = due_date - timedelta(days=1)
    start_date = min(max(earliest_date, today), last_date)
    target_date = min(max(target_date, start_date), last_date)
    candidates: list[date] = []
    current = start_date
    while current <= last_date:
        candidates.append(current)
        current += timedelta(days=1)
    return sorted(candidates, key=lambda item: (abs((item - target_date).days), item))


def _select_date(
    *,
    today: date,
    due_date: date,
    days_before: int,
    earliest_date: date,
    minutes: int,
    daily_capacity_minutes: int,
    load_by_day: dict[str, int],
) -> date:
    target_date = due_date - timedelta(days=days_before)
    candidates = _possible_dates(today, due_date, target_date, earliest_date)
    available = [
        item
        for item in candidates
        if load_by_day[item.isoformat()] + minutes <= daily_capacity_minutes
    ]
    if available:
        return available[0]
    return min(
        candidates,
        key=lambda item: (load_by_day[item.isoformat()], abs((item - target_date).days), item),
    )


def rebuild_preparation_plan(
    db: Session,
    project_id: str,
    obligations: list[CourseObligation],
    daily_capacity_minutes: int,
    today: date | None = None,
) -> list[PreparationMilestone]:
    planning_date = today or date.today()
    existing_completed = (
        db.query(PreparationMilestone)
        .filter(
            PreparationMilestone.project_id == project_id,
            PreparationMilestone.status == "completed",
        )
        .all()
    )
    completed_keys = {(item.obligation_id, item.milestone_type) for item in existing_completed}
    load_by_day: dict[str, int] = defaultdict(int)
    for item in existing_completed:
        load_by_day[item.scheduled_date] += item.estimated_minutes
    # Workload balance: avoid scheduling milestones on days the student already
    # has open course tasks due. Treat each open task as an estimated block of
    # minutes based on its priority.
    for day, minutes in _task_load_by_day(db, project_id).items():
        load_by_day[day] += minutes

    db.query(PreparationMilestone).filter(
        PreparationMilestone.project_id == project_id,
        PreparationMilestone.status != "completed",
    ).delete(synchronize_session=False)

    now = utc_now_iso()
    new_items: list[PreparationMilestone] = []
    dated_obligations = sorted(
        [item for item in obligations if item.status == "confirmed" and item.due_date],
        key=lambda item: item.due_date or "",
    )
    for obligation in dated_obligations:
        due_date = date.fromisoformat(obligation.due_date or "")
        if due_date < planning_date:
            continue
        templates = MILESTONE_TEMPLATES.get(obligation.obligation_type, MILESTONE_TEMPLATES["other"])
        if due_date == planning_date:
            templates = [("Check requirements and act on today's deadline", "urgent", 0, 20)]

        earliest_date = planning_date
        for sequence, (title, milestone_type, days_before, minutes) in enumerate(templates, start=1):
            if (obligation.id, milestone_type) in completed_keys:
                continue
            scheduled_date = _select_date(
                today=planning_date,
                due_date=due_date,
                days_before=days_before,
                earliest_date=earliest_date,
                minutes=minutes,
                daily_capacity_minutes=daily_capacity_minutes,
                load_by_day=load_by_day,
            )
            item = PreparationMilestone(
                id=str(uuid4()),
                project_id=project_id,
                obligation_id=obligation.id,
                title=title,
                milestone_type=milestone_type,
                sequence=sequence,
                scheduled_date=scheduled_date.isoformat(),
                estimated_minutes=minutes,
                status="planned",
                completed_at=None,
                created_at=now,
                updated_at=now,
            )
            db.add(item)
            new_items.append(item)
            load_by_day[item.scheduled_date] += minutes
            earliest_date = scheduled_date

    db.commit()
    return existing_completed + new_items
