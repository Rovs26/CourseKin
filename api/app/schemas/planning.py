from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


ObligationType = Literal["quiz", "exam", "assignment", "project", "paper", "reading", "other"]
ObligationStatus = Literal["proposed", "confirmed", "dismissed"]
Confidence = Literal["high", "medium", "low"]


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
