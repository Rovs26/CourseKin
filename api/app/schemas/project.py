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
    user_id: Optional[str] = None

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


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    project_type: Optional[str] = None
    age_bracket: Optional[str] = None
    learning_mode: Optional[str] = None
    field_of_study: Optional[str] = None
    source_mode: Optional[str] = None
    template_id: Optional[str] = None

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


class ProjectResponse(BaseModel):
    id: str
    title: str
    project_type: str
    age_bracket: str
    learning_mode: str
    field_of_study: str
    source_mode: str
    template_id: Optional[str] = None
    user_id: Optional[str] = None
    created_at: str
    updated_at: str


class ProjectListResponse(BaseModel):
    items: list[ProjectResponse]
    total: int
