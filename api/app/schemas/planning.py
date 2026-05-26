from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


ObligationType = Literal["quiz", "exam", "assignment", "project", "paper", "reading", "other"]
ObligationStatus = Literal["proposed", "confirmed", "dismissed"]
Confidence = Literal["high", "medium", "low"]
MilestoneStatus = Literal["planned", "completed", "skipped"]


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
