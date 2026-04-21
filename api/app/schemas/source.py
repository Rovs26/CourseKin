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


class PresignUploadRequest(BaseModel):
    project_id: str
    filename: str
    content_type: str

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


class FinalizeUploadRequest(BaseModel):
    project_id: str
    storage_key: str
    title: str

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
    created_at: str
    updated_at: str


class SourceListResponse(BaseModel):
    items: list[SourceResponse]
    total: int
