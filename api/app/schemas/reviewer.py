from pydantic import BaseModel, field_validator
from typing import Optional

from app.schemas.job import MergeMode, SectionCounts, VALID_SECTIONS


class DefinitionItem(BaseModel):
    term: str
    definition: str


class QAItem(BaseModel):
    question: str
    answer: str


class QuizItem(BaseModel):
    question: str
    choices: list[str]
    answer: str
    rationale: str


class FlashcardItem(BaseModel):
    front: str
    back: str


class ReviewerContent(BaseModel):
    model_config = {"extra": "allow"}

    summary: Optional[str] = None
    key_points: Optional[list[str]] = None
    definitions: Optional[list[DefinitionItem]] = None
    qa: Optional[list[QAItem]] = None
    quiz: Optional[list[QuizItem]] = None
    flashcards: Optional[list[FlashcardItem]] = None


class ReviewerResponse(BaseModel):
    project_id: str
    source_id: Optional[str] = None
    status: str
    output_type: str
    version: int
    content_json: Optional[ReviewerContent] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ReviewerRegenerateRequest(BaseModel):
    project_id: str
    source_id: Optional[str] = None
    sections: Optional[list[str]] = None  # None = all sections
    counts: Optional[SectionCounts] = None
    merge_mode: MergeMode = "skip"
    turnstile_token: Optional[str] = None

    @field_validator("sections")
    @classmethod
    def validate_sections(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is not None and any(section not in VALID_SECTIONS for section in v):
            raise ValueError("Unknown reviewer section")
        return v


class SourceGenerationConfig(BaseModel):
    """Config for a single source within a batch generation request."""
    source_id: str
    sections: Optional[list[str]] = None
    counts: Optional[SectionCounts] = None
    merge_mode: MergeMode = "append"  # Default to append for multi-source

    @field_validator("sections")
    @classmethod
    def validate_sections(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is not None and any(section not in VALID_SECTIONS for section in v):
            raise ValueError("Unknown reviewer section")
        return v


class BatchGenerateRequest(BaseModel):
    """Generate from multiple sources sequentially, each with its own config."""
    project_id: str
    sources: list[SourceGenerationConfig]
    turnstile_token: Optional[str] = None


class BatchGenerateResponse(BaseModel):
    """Returns a single batch job ID. Individual source jobs are tracked internally."""
    batch_id: str
    project_id: str
    total_sources: int
    status: str
    job_ids: list[str]


class CustomPdfRequest(BaseModel):
    """Custom PDF export with user-defined section order and visibility."""
    section_order: list[str]
    visible_sections: list[str]
