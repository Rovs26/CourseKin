from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Literal, Optional

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
    topic: Optional[str] = None


class FlashcardItem(BaseModel):
    front: str
    back: str


class CitationItem(BaseModel):
    chunk_id: str
    source_id: str
    source_title: str
    page_number: Optional[int] = None
    excerpt: str


class EvidenceItem(BaseModel):
    status: Literal["supported", "weak_support", "not_found"]
    citations: list[CitationItem] = Field(default_factory=list)


class ReviewerEvidence(BaseModel):
    summary: Optional[EvidenceItem] = None
    key_points: Optional[list[EvidenceItem]] = None
    definitions: Optional[list[EvidenceItem]] = None
    qa: Optional[list[EvidenceItem]] = None
    quiz: Optional[list[EvidenceItem]] = None
    flashcards: Optional[list[EvidenceItem]] = None


class ReviewerContent(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    summary: Optional[str] = None
    key_points: Optional[list[str]] = None
    definitions: Optional[list[DefinitionItem]] = None
    qa: Optional[list[QAItem]] = None
    quiz: Optional[list[QuizItem]] = None
    flashcards: Optional[list[FlashcardItem]] = None
    evidence: Optional[ReviewerEvidence] = Field(default=None, alias="_evidence")


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


class ReviewerFeedbackRequest(BaseModel):
    section: str
    item_index: Optional[int] = None
    rating: Literal["accurate", "unsupported", "unclear", "incorrect"]
    comment: Optional[str] = None

    @field_validator("section")
    @classmethod
    def validate_section(cls, v: str) -> str:
        if v not in VALID_SECTIONS:
            raise ValueError("Unknown reviewer section")
        return v

    @field_validator("comment")
    @classmethod
    def validate_comment(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        value = v.strip()
        if len(value) > 1000:
            raise ValueError("Feedback comment must be 1000 characters or fewer")
        return value or None


class ReviewerFeedbackResponse(BaseModel):
    id: str
    project_id: str
    reviewer_version: int
    section: str
    item_index: Optional[int] = None
    rating: Literal["accurate", "unsupported", "unclear", "incorrect"]
    comment: Optional[str] = None
    created_at: str
    updated_at: str


class QuizAttemptAnswerRequest(BaseModel):
    item_index: int = Field(ge=0, le=50)
    selected_answer: str = Field(min_length=1, max_length=2000)


class QuizAttemptRequest(BaseModel):
    reviewer_version: int = Field(ge=1)
    answers: list[QuizAttemptAnswerRequest] = Field(min_length=1, max_length=50)
    duration_seconds: Optional[int] = Field(default=None, ge=0, le=86400)

    @field_validator("answers")
    @classmethod
    def validate_unique_items(
        cls, v: list[QuizAttemptAnswerRequest]
    ) -> list[QuizAttemptAnswerRequest]:
        indices = [answer.item_index for answer in v]
        if len(indices) != len(set(indices)):
            raise ValueError("Quiz answers must not contain duplicate questions")
        return v


class QuizAttemptResult(BaseModel):
    item_index: int
    question: str
    selected_answer: str
    correct_answer: str
    rationale: str
    is_correct: bool
    topic: Optional[str] = None
    evidence: Optional[EvidenceItem] = None


class QuizAttemptResponse(BaseModel):
    id: str
    project_id: str
    reviewer_version: int
    results: list[QuizAttemptResult]
    total_questions: int
    correct_answers: int
    score_percent: int
    duration_seconds: Optional[int] = None
    created_at: str


class QuizFocusTopic(BaseModel):
    topic: str
    questions_answered: int
    correct_answers: int
    score_percent: int
    missed_count: int
    status: Literal["needs_review", "practicing", "recall_improving"]
    recommended_action: str


class QuizPracticeSummaryResponse(BaseModel):
    total_attempts: int
    total_answered: int
    total_correct: int
    latest_score_percent: Optional[int] = None
    best_score_percent: Optional[int] = None
    practice_signal: Literal["no_practice", "early", "needs_review", "building"]
    practice_signal_label: str
    signal_note: str
    next_action: str
    focus_topics: list[QuizFocusTopic]
    focus_questions: list[QuizAttemptResult]
    recent_attempts: list[QuizAttemptResponse]
