from pydantic import BaseModel, field_validator
from typing import Optional, Literal


VALID_SECTIONS = ["summary", "key_points", "definitions", "qa", "quiz", "flashcards"]

MergeMode = Literal["skip", "replace", "append"]


class SectionCounts(BaseModel):
    key_points: Optional[int] = None
    definitions: Optional[int] = None
    qa: Optional[int] = None
    quiz: Optional[int] = None
    flashcards: Optional[int] = None

    @field_validator("key_points", "definitions", "qa", "quiz", "flashcards")
    @classmethod
    def validate_count(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not 1 <= v <= 50:
            raise ValueError("Section count must be between 1 and 50")
        return v


class JobGenerateRequest(BaseModel):
    project_id: str
    source_id: Optional[str] = None
    job_type: str = "generate-reviewer"
    sections: Optional[list[str]] = None  # None = all sections
    counts: Optional[SectionCounts] = None
    merge_mode: MergeMode = "skip"  # skip=additive, replace=overwrite, append=concat lists
    turnstile_token: Optional[str] = None  # Required for first 3 generations per user

    @field_validator("sections")
    @classmethod
    def validate_sections(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is not None and any(section not in VALID_SECTIONS for section in v):
            raise ValueError("Unknown reviewer section")
        return v


class JobResponse(BaseModel):
    id: str
    project_id: str
    source_id: Optional[str] = None
    job_type: str
    status: str
    stage: str
    created_at: str
    updated_at: str
    error_message: Optional[str] = None


class JobListResponse(BaseModel):
    items: list[JobResponse]
    total: int
