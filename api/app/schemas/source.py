from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator


SourcePurpose = Literal["study_material", "syllabus", "lecture_notes", "assignment_brief"]


class SyllabusPrefillRequest(BaseModel):
    text: str = Field(min_length=20, max_length=200_000)


class SyllabusPrefillResponse(BaseModel):
    title: str | None = None
    course_code: str | None = None
    field_of_study: str | None = None
    term: str | None = None
    instructor: str | None = None
    meeting_schedule: str | None = None


class SourceTextCreate(BaseModel):
    project_id: str
    title: str
    text: str | None = None
    content: str | None = None
    purpose: SourcePurpose = "study_material"

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        if len(v) > 200:
            raise ValueError("Title must be 200 characters or fewer")
        return v

    @model_validator(mode="after")
    def normalize_text(self):
        if not self.text and self.content:
            self.text = self.content
        if not self.text:
            raise ValueError("Either 'text' or 'content' is required")
        return self


class SourceUrlCreate(BaseModel):
    project_id: str
    title: str
    url: HttpUrl
    purpose: SourcePurpose = "study_material"

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        if len(v) > 200:
            raise ValueError("Title must be 200 characters or fewer")
        return v


class PresignUploadRequest(BaseModel):
    project_id: str
    filename: str
    content_type: str
    size_bytes: int

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Filename cannot be empty")
        if not v.lower().endswith(".pdf"):
            raise ValueError("Only PDF files are supported")
        return v

    @field_validator("content_type")
    @classmethod
    def validate_content_type(cls, v: str) -> str:
        if v != "application/pdf":
            raise ValueError("content_type must be 'application/pdf'")
        return v

    @field_validator("size_bytes")
    @classmethod
    def validate_size_bytes(cls, v: int) -> int:
        if v <= 0 or v > 25 * 1024 * 1024:
            raise ValueError("PDF size must be between 1 byte and 25 MB")
        return v


class FinalizeUploadRequest(BaseModel):
    project_id: str
    storage_key: str
    title: str
    purpose: SourcePurpose = "study_material"

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        if len(v) > 200:
            raise ValueError("Title must be 200 characters or fewer")
        return v

    @field_validator("storage_key")
    @classmethod
    def validate_storage_key(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("storage_key cannot be empty")
        return v


class SourceResponse(BaseModel):
    id: str
    project_id: str
    title: str
    type: str
    status: str
    purpose: SourcePurpose = "study_material"
    created_at: str
    updated_at: str


class SourceListResponse(BaseModel):
    items: list[SourceResponse]
    total: int


class SourcePurposeUpdate(BaseModel):
    purpose: SourcePurpose


class SourceChunkResponse(BaseModel):
    id: str
    source_id: str
    ordinal: int
    page_number: int | None = None
    text: str


class SourceChunkListResponse(BaseModel):
    source_id: str
    source_title: str
    items: list[SourceChunkResponse]
