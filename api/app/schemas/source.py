from pydantic import BaseModel, HttpUrl, field_validator, model_validator


class SourceTextCreate(BaseModel):
    project_id: str
    title: str
    text: str | None = None
    content: str | None = None

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

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        if len(v) > 200:
            raise ValueError("Title must be 200 characters or fewer")
        return v


class SourceResponse(BaseModel):
    id: str
    project_id: str
    title: str
    type: str
    status: str
    created_at: str
    updated_at: str


class SourceListResponse(BaseModel):
    items: list[SourceResponse]
    total: int
