from pydantic import BaseModel, field_validator
from typing import Optional


class ProjectCreate(BaseModel):
    title: str
    project_type: str
    age_bracket: str
    learning_mode: str
    field_of_study: str
    source_mode: str
    template_id: Optional[str] = None
    course_code: Optional[str] = None
    term: Optional[str] = None
    instructor: Optional[str] = None
    meeting_schedule: Optional[str] = None
    # user_id is set server-side from the Clerk JWT — not accepted from the request body

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        if len(v) > 200:
            raise ValueError("Title must be 200 characters or fewer")
        return v

    @field_validator("project_type", "age_bracket", "learning_mode", "source_mode", "field_of_study")
    @classmethod
    def validate_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be empty")
        if len(v) > 200:
            raise ValueError("Field must be 200 characters or fewer")
        return v

    @field_validator("course_code", "term", "instructor", "meeting_schedule")
    @classmethod
    def validate_optional_course_field(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        value = v.strip()
        if not value:
            return None
        if len(value) > 500:
            raise ValueError("Course field must be 500 characters or fewer")
        return value


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    project_type: Optional[str] = None
    age_bracket: Optional[str] = None
    learning_mode: Optional[str] = None
    field_of_study: Optional[str] = None
    source_mode: Optional[str] = None
    template_id: Optional[str] = None
    course_code: Optional[str] = None
    term: Optional[str] = None
    instructor: Optional[str] = None
    meeting_schedule: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Title cannot be empty")
            if len(v) > 200:
                raise ValueError("Title must be 200 characters or fewer")
        return v

    @field_validator("course_code", "term", "instructor", "meeting_schedule")
    @classmethod
    def validate_optional_course_field(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        value = v.strip()
        if not value:
            return None
        if len(value) > 500:
            raise ValueError("Course field must be 500 characters or fewer")
        return value


class ProjectResponse(BaseModel):
    id: str
    title: str
    project_type: str
    age_bracket: str
    learning_mode: str
    field_of_study: str
    source_mode: str
    template_id: Optional[str] = None
    course_code: Optional[str] = None
    term: Optional[str] = None
    instructor: Optional[str] = None
    meeting_schedule: Optional[str] = None
    user_id: Optional[str] = None
    created_at: str
    updated_at: str


class ProjectListResponse(BaseModel):
    items: list[ProjectResponse]
    total: int


class ProjectSummaryResponse(BaseModel):
    project: ProjectResponse
    source_count: int
    processed_source_count: int
    reviewer_status: str
    reviewer_coverage_percent: int
    activity_at: str


class ProjectSummaryListResponse(BaseModel):
    items: list[ProjectSummaryResponse]
    total: int
