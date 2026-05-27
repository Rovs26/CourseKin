"""Pydantic schemas for the Notebook (study cards + spaced repetition)."""

from typing import Literal, Optional

from pydantic import BaseModel, field_validator


def _validate_tags(value: Optional[list]) -> Optional[list[str]]:
    if value is None:
        return None
    if not isinstance(value, list):
        raise ValueError("Tags must be a list")
    if len(value) > 10:
        raise ValueError("Cards support up to 10 tags")
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


class NotebookCardCreateRequest(BaseModel):
    front: str
    back: Optional[str] = None
    tags: Optional[list[str]] = None
    source_stream_entry_id: Optional[str] = None

    @field_validator("front")
    @classmethod
    def validate_front(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Card front cannot be empty")
        if len(value) > 4000:
            raise ValueError("Card front must be 4000 characters or fewer")
        return value

    @field_validator("back")
    @classmethod
    def validate_back(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if len(value) > 8000:
            raise ValueError("Card back must be 8000 characters or fewer")
        return value or None

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value):
        return _validate_tags(value)


class NotebookCardUpdateRequest(BaseModel):
    front: Optional[str] = None
    back: Optional[str] = None
    tags: Optional[list[str]] = None

    @field_validator("front")
    @classmethod
    def validate_front(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Card front cannot be empty")
        if len(value) > 4000:
            raise ValueError("Card front must be 4000 characters or fewer")
        return value

    @field_validator("back")
    @classmethod
    def validate_back(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if len(value) > 8000:
            raise ValueError("Card back must be 8000 characters or fewer")
        return value or None

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value):
        return _validate_tags(value)


class NotebookCardResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    source_stream_entry_id: Optional[str] = None
    origin: Literal["manual", "stream_entry", "quiz_gap", "ai_generated"]
    front: str
    back: Optional[str] = None
    tags: list[str] = []
    ease_factor: float
    interval_days: int
    repetitions: int
    due_date: Optional[str] = None
    last_reviewed_at: Optional[str] = None
    last_quality: Optional[int] = None
    created_at: str
    updated_at: str


class NotebookCardListResponse(BaseModel):
    items: list[NotebookCardResponse]
    total: int
    due_now: int


class NotebookCardReviewRequest(BaseModel):
    quality: int

    @field_validator("quality")
    @classmethod
    def validate_quality(cls, value: int) -> int:
        if value < 0 or value > 5:
            raise ValueError("Quality must be between 0 and 5 (SM-2 scale)")
        return value


class ConvertStreamEntryToCardRequest(BaseModel):
    back: Optional[str] = None

    @field_validator("back")
    @classmethod
    def validate_back(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if len(value) > 8000:
            raise ValueError("Card back must be 8000 characters or fewer")
        return value or None
