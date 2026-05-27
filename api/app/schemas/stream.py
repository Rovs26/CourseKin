from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.source import SourcePurpose


StreamEntryType = Literal["note", "question", "reflection", "coaching"]
StreamCaptureType = Literal["note", "question", "reflection"]
ConfusionStatus = Literal["open", "resolved"]
CourseAnswerStatus = Literal["queued", "generating", "answered", "insufficient_evidence", "failed"]
CourseAnswerMode = Literal["standard", "simplified", "step_by_step", "example_first"]
CoachingMode = Literal["assignment_plan", "draft_feedback", "office_hours"]
CoachingStatus = Literal["queued", "generating", "ready", "insufficient_evidence", "failed"]


class CourseStreamEntryWriteRequest(BaseModel):
    entry_type: StreamCaptureType
    content: str
    linked_source_ids: list[str] = Field(default_factory=list)

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Entry cannot be empty")
        if len(value) > 10000:
            raise ValueError("Entry must be 10000 characters or fewer")
        return value

    @field_validator("linked_source_ids")
    @classmethod
    def validate_linked_source_ids(cls, value: list[str]) -> list[str]:
        unique_ids: list[str] = []
        for source_id in value:
            source_id = source_id.strip()
            if not source_id:
                raise ValueError("Linked source IDs cannot be empty")
            if source_id not in unique_ids:
                unique_ids.append(source_id)
        if len(unique_ids) > 10:
            raise ValueError("An entry can link at most 10 course materials")
        return unique_ids


class CourseStreamLinkedSourceResponse(BaseModel):
    id: str
    title: str
    type: str
    status: str
    purpose: SourcePurpose


class CourseAnswerCitationResponse(BaseModel):
    chunk_id: str
    source_id: str
    source_title: str
    page_number: int | None = None
    excerpt: str


class CourseAnswerEvidenceResponse(BaseModel):
    status: Literal["supported", "not_found"]
    source_scope: Literal["course_materials_only"] = "course_materials_only"
    citations: list[CourseAnswerCitationResponse] = Field(default_factory=list)


class CourseStreamEntryResponse(BaseModel):
    id: str
    project_id: str
    entry_type: StreamEntryType
    content: str
    linked_sources: list[CourseStreamLinkedSourceResponse]
    confusion_status: ConfusionStatus | None = None
    answer_status: CourseAnswerStatus | None = None
    answer_mode: CourseAnswerMode | None = None
    answer_content: str | None = None
    answer_evidence: CourseAnswerEvidenceResponse | None = None
    answer_job_id: str | None = None
    answer_generated_at: str | None = None
    coaching_mode: CoachingMode | None = None
    related_obligation_id: str | None = None
    coaching_context: dict | None = None
    coaching_status: CoachingStatus | None = None
    coaching_output: dict | None = None
    coaching_evidence: CourseAnswerEvidenceResponse | None = None
    coaching_job_id: str | None = None
    coaching_generated_at: str | None = None
    created_at: str
    updated_at: str


class CourseStreamEntryListResponse(BaseModel):
    items: list[CourseStreamEntryResponse]
    total: int


class CourseConfusionStatusUpdate(BaseModel):
    status: ConfusionStatus


class CourseAnswerRequest(BaseModel):
    explanation_mode: CourseAnswerMode = "standard"
    turnstile_token: str | None = None


class CourseCoachingRequest(BaseModel):
    coaching_mode: CoachingMode
    content: str
    obligation_id: str | None = None
    linked_source_ids: list[str] = Field(default_factory=list)
    turnstile_token: str | None = None

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Coaching request cannot be empty")
        if len(value) > 6000:
            raise ValueError("Coaching requests must be 6000 characters or fewer")
        return value

    @field_validator("linked_source_ids")
    @classmethod
    def validate_linked_source_ids(cls, value: list[str]) -> list[str]:
        unique_ids: list[str] = []
        for source_id in value:
            source_id = source_id.strip()
            if not source_id:
                raise ValueError("Linked source IDs cannot be empty")
            if source_id not in unique_ids:
                unique_ids.append(source_id)
        if not unique_ids:
            raise ValueError("Select at least one course material")
        if len(unique_ids) > 10:
            raise ValueError("A coaching request can link at most 10 course materials")
        return unique_ids

    @model_validator(mode="after")
    def validate_assignment_target(self):
        if self.coaching_mode in {"assignment_plan", "draft_feedback"} and not self.obligation_id:
            raise ValueError("Assignment coaching requires a confirmed course obligation")
        return self
