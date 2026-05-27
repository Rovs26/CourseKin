from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


ObligationType = Literal["quiz", "exam", "assignment", "project", "paper", "reading", "other"]
ObligationStatus = Literal["proposed", "confirmed", "dismissed"]
Confidence = Literal["high", "medium", "low"]
MilestoneStatus = Literal["planned", "completed", "skipped"]
TaskPriority = Literal["low", "medium", "high"]
TaskStatus = Literal["open", "completed"]


class SyllabusExtractionRequest(BaseModel):
    source_id: str
    turnstile_token: Optional[str] = None


class CourseObligationResponse(BaseModel):
    id: str
    project_id: str
    source_id: str
    title: str
    obligation_type: ObligationType
    due_date: Optional[str] = None
    details: Optional[str] = None
    grading_criteria: Optional[str] = None
    confidence: Confidence
    uncertain_fields: list[str] = Field(default_factory=list)
    status: ObligationStatus
    created_at: str
    updated_at: str


class CourseObligationListResponse(BaseModel):
    items: list[CourseObligationResponse]
    total: int


class CourseObligationReviewRequest(BaseModel):
    title: str
    obligation_type: ObligationType
    due_date: Optional[str] = None
    details: Optional[str] = None
    grading_criteria: Optional[str] = None
    status: Literal["confirmed", "dismissed"]

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be empty")
        if len(value) > 200:
            raise ValueError("Title must be 200 characters or fewer")
        return value

    @field_validator("due_date")
    @classmethod
    def validate_due_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None or not value.strip():
            return None
        date.fromisoformat(value)
        return value

    @field_validator("details", "grading_criteria")
    @classmethod
    def validate_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if len(value) > 2000:
            raise ValueError("Text must be 2000 characters or fewer")
        return value or None


class BuildPreparationPlanRequest(BaseModel):
    daily_capacity_minutes: int = Field(default=120, ge=30, le=360)
    planning_start_date: Optional[str] = None

    @field_validator("planning_start_date")
    @classmethod
    def validate_planning_start_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None or not value.strip():
            return None
        date.fromisoformat(value)
        return value


class PreparationMilestoneResponse(BaseModel):
    id: str
    project_id: str
    obligation_id: str
    title: str
    milestone_type: str
    sequence: int
    scheduled_date: str
    estimated_minutes: int
    status: MilestoneStatus
    completed_at: Optional[str] = None
    created_at: str
    updated_at: str


class DayLoadResponse(BaseModel):
    date: str
    estimated_minutes: int
    session_count: int
    exceeds_capacity: bool


class AssessmentRunwayItemResponse(BaseModel):
    obligation: CourseObligationResponse
    milestones: list[PreparationMilestoneResponse]
    preparation_progress_percent: int
    missing_materials: list[str] = Field(default_factory=list)
    next_action: Optional[str] = None


class PreparationRunwayResponse(BaseModel):
    items: list[AssessmentRunwayItemResponse]
    daily_load: list[DayLoadResponse]
    confirmed_without_due_date: list[CourseObligationResponse]
    total_sessions: int
    completed_sessions: int
    preparation_progress_percent: int
    daily_capacity_minutes: int


class PreparationMilestoneUpdateRequest(BaseModel):
    status: MilestoneStatus


class ReminderPreferenceResponse(BaseModel):
    project_id: str
    enabled: bool
    lead_days: int


class ReminderPreferenceUpdateRequest(BaseModel):
    enabled: bool
    lead_days: int = Field(ge=0, le=14)


class PreparationReminderResponse(BaseModel):
    milestone_id: str
    project_id: str
    project_title: str
    course_code: Optional[str] = None
    obligation_id: str
    obligation_title: str
    obligation_due_date: Optional[str] = None
    milestone_title: str
    scheduled_date: str
    estimated_minutes: int
    urgency: Literal["overdue", "today", "upcoming"]
    days_until: int


class PreparationReminderListResponse(BaseModel):
    items: list[PreparationReminderResponse]
    total: int
    reference_date: str


VALID_RECURRENCE = {"daily", "weekly", "biweekly", "monthly"}


def _validate_tags(value: Optional[list]) -> Optional[list[str]]:
    if value is None:
        return None
    if not isinstance(value, list):
        raise ValueError("Tags must be a list")
    if len(value) > 10:
        raise ValueError("Tasks support up to 10 tags")
    cleaned: list[str] = []
    seen: set[str] = set()
    for tag in value:
        if not isinstance(tag, str):
            raise ValueError("Each tag must be a string")
        normalized = tag.strip().lower()
        if not normalized:
            continue
        if len(normalized) > 30:
            raise ValueError("Each tag must be 30 characters or fewer")
        if normalized in seen:
            continue
        seen.add(normalized)
        cleaned.append(normalized)
    return cleaned or None


def _validate_recurrence(value: Optional[str]) -> Optional[str]:
    if value is None or not value.strip():
        return None
    normalized = value.strip().lower()
    if normalized not in VALID_RECURRENCE:
        raise ValueError(
            f"Recurrence must be one of {sorted(VALID_RECURRENCE)}"
        )
    return normalized


class CourseTaskCreateRequest(BaseModel):
    title: str
    notes: Optional[str] = None
    due_date: Optional[str] = None
    priority: TaskPriority = "medium"
    parent_task_id: Optional[str] = None
    tags: Optional[list[str]] = None
    recurrence_rule: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Task title cannot be empty")
        if len(value) > 200:
            raise ValueError("Task title must be 200 characters or fewer")
        return value

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if len(value) > 2000:
            raise ValueError("Task notes must be 2000 characters or fewer")
        return value or None

    @field_validator("due_date")
    @classmethod
    def validate_task_due_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None or not value.strip():
            return None
        date.fromisoformat(value)
        return value

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value):
        return _validate_tags(value)

    @field_validator("recurrence_rule")
    @classmethod
    def validate_recurrence(cls, value):
        return _validate_recurrence(value)


class CourseTaskUpdateRequest(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    parent_task_id: Optional[str] = None
    tags: Optional[list[str]] = None
    recurrence_rule: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            raise ValueError("Task title cannot be empty")
        value = value.strip()
        if not value:
            raise ValueError("Task title cannot be empty")
        if len(value) > 200:
            raise ValueError("Task title must be 200 characters or fewer")
        return value

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if len(value) > 2000:
            raise ValueError("Task notes must be 2000 characters or fewer")
        return value or None

    @field_validator("due_date")
    @classmethod
    def validate_task_due_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None or not value.strip():
            return None
        date.fromisoformat(value)
        return value

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value):
        return _validate_tags(value)

    @field_validator("recurrence_rule")
    @classmethod
    def validate_recurrence(cls, value):
        return _validate_recurrence(value)


class CourseTaskResponse(BaseModel):
    id: str
    project_id: str
    project_title: str
    course_code: Optional[str] = None
    title: str
    notes: Optional[str] = None
    due_date: Optional[str] = None
    priority: TaskPriority
    status: TaskStatus
    origin: Literal["student"]
    parent_task_id: Optional[str] = None
    tags: list[str] = []
    recurrence_rule: Optional[str] = None
    recurrence_parent_id: Optional[str] = None
    focus_seconds_total: int = 0
    subtask_count: int = 0
    completed_subtask_count: int = 0
    completed_at: Optional[str] = None
    created_at: str
    updated_at: str


class CourseTaskListResponse(BaseModel):
    items: list[CourseTaskResponse]
    total: int


class TaskFocusSessionResponse(BaseModel):
    id: str
    task_id: str
    project_id: str
    started_at: str
    ended_at: Optional[str] = None
    duration_seconds: Optional[int] = None
    notes: Optional[str] = None


class TaskFocusStartRequest(BaseModel):
    notes: Optional[str] = None

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if len(value) > 500:
            raise ValueError("Focus notes must be 500 characters or fewer")
        return value or None


class TaskFocusStopRequest(BaseModel):
    notes: Optional[str] = None

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if len(value) > 500:
            raise ValueError("Focus notes must be 500 characters or fewer")
        return value or None


class TaskStreakResponse(BaseModel):
    current_streak_days: int
    longest_streak_days: int
    last_completion_date: Optional[str] = None
    completion_dates_30d: list[str] = []


class TaskStatsResponse(BaseModel):
    total: int
    open: int
    completed: int
    overdue: int
    due_today: int
    due_this_week: int
    completion_rate_percent: int
    completed_last_7d: int
    completed_last_30d: int
    focus_seconds_last_7d: int
    focus_seconds_total: int
    streak: TaskStreakResponse
    tag_counts: list[dict] = []


class CalendarAgendaItemResponse(BaseModel):
    id: str
    item_type: Literal["deadline", "preparation_session", "task"]
    project_id: str
    project_title: str
    course_code: Optional[str] = None
    title: str
    date: str
    status: str
    details: Optional[str] = None
    priority: Optional[TaskPriority] = None
    estimated_minutes: Optional[int] = None
    obligation_id: Optional[str] = None


class CalendarAgendaResponse(BaseModel):
    items: list[CalendarAgendaItemResponse]
    unscheduled_tasks: list[CourseTaskResponse]
    start_date: str
    end_date: str
    reference_date: str
    open_tasks: int
    overdue_tasks: int
    upcoming_deadlines: int
