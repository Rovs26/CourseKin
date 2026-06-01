"""Schemas for the natural-language day planner."""

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


PlannerKind = Literal["study", "review", "exercise", "errand", "personal", "other"]
PlannerTimeOfDay = Literal["morning", "afternoon", "evening", "night", "any"]
PlannerBlockStatus = Literal["planned", "completed", "skipped"]


def _validate_date(value: Optional[str]) -> Optional[str]:
    if value is None or not value.strip():
        return None
    date.fromisoformat(value)
    return value


def _validate_time(value: Optional[str]) -> Optional[str]:
    if value is None or not value.strip():
        return None
    value = value.strip()
    parts = value.split(":")
    if len(parts) != 2 or not (parts[0].isdigit() and parts[1].isdigit()):
        raise ValueError("start_time must be HH:MM")
    hh, mm = int(parts[0]), int(parts[1])
    if not (0 <= hh < 24 and 0 <= mm < 60):
        raise ValueError("start_time must be a valid 24h time")
    return f"{hh:02d}:{mm:02d}"


class PlannerSuggestRequest(BaseModel):
    text: str = Field(min_length=3, max_length=4000)
    turnstile_token: Optional[str] = None

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Describe what you plan to do")
        return value


class PlannerSuggestion(BaseModel):
    title: str
    kind: PlannerKind
    scheduled_date: str
    start_time: Optional[str] = None
    duration_minutes: int
    time_of_day: PlannerTimeOfDay
    notes: Optional[str] = None
    conflict: bool = False


class PlannerSuggestResponse(BaseModel):
    suggestions: list[PlannerSuggestion]
    model: str
    cost_usd: float


class AssistantChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class AssistantChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[AssistantChatMessage] = Field(default_factory=list, max_length=20)
    turnstile_token: Optional[str] = None

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Type a message")
        return value


class AssistantChatResponse(BaseModel):
    mode: Literal["plan", "reply"]
    reply: str
    suggestions: list[PlannerSuggestion] = Field(default_factory=list)
    model: str
    cost_usd: float


class PlannerBlockInput(BaseModel):
    title: str = Field(max_length=100)
    kind: PlannerKind = "personal"
    scheduled_date: str
    start_time: Optional[str] = None
    duration_minutes: int = Field(default=30, ge=15, le=480)
    notes: Optional[str] = Field(default=None, max_length=300)
    project_id: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Block title cannot be empty")
        return value

    @field_validator("scheduled_date")
    @classmethod
    def validate_scheduled_date(cls, value: str) -> str:
        date.fromisoformat(value)
        return value

    @field_validator("start_time")
    @classmethod
    def validate_start_time(cls, value: Optional[str]) -> Optional[str]:
        return _validate_time(value)


class PlannerConfirmRequest(BaseModel):
    blocks: list[PlannerBlockInput] = Field(min_length=1, max_length=20)


class PlannerBlockResponse(BaseModel):
    id: str
    project_id: Optional[str] = None
    title: str
    notes: Optional[str] = None
    kind: PlannerKind
    scheduled_date: str
    start_time: Optional[str] = None
    duration_minutes: int
    status: PlannerBlockStatus
    origin: str
    created_at: str
    updated_at: str


class PlannerBlockListResponse(BaseModel):
    items: list[PlannerBlockResponse]
    total: int


class PlannerBlockUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=100)
    scheduled_date: Optional[str] = None
    start_time: Optional[str] = None
    duration_minutes: Optional[int] = Field(default=None, ge=15, le=480)
    status: Optional[PlannerBlockStatus] = None
    notes: Optional[str] = Field(default=None, max_length=300)

    @field_validator("scheduled_date")
    @classmethod
    def validate_scheduled_date(cls, value: Optional[str]) -> Optional[str]:
        return _validate_date(value)

    @field_validator("start_time")
    @classmethod
    def validate_start_time(cls, value: Optional[str]) -> Optional[str]:
        return _validate_time(value)
