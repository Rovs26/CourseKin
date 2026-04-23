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


class JobGenerateRequest(BaseModel):
    project_id: str
    source_id: Optional[str] = None
    job_type: str = "generate-reviewer"
    sections: Optional[list[str]] = None  # None = all sections
    counts: Optional[SectionCounts] = None
    merge_mode: MergeMode = "skip"  # skip=additive, replace=overwrite, append=concat lists
    turnstile_token: Optional[str] = None  # Required for first 3 generations per user


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
