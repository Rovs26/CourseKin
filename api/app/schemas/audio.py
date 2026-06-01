"""Pydantic schemas for Audio E1 endpoints. See docs/audio_e1_design.md."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator


ALLOWED_AUDIO_MIME_TYPES = {
    "audio/mpeg",
    "audio/mp3",  # some browsers report this for mp3
    "audio/mp4",
    "audio/m4a",  # Safari sometimes uses this
    "audio/wav",
    "audio/x-wav",
    "audio/webm",
    "audio/ogg",
}


class AudioConsentRequest(BaseModel):
    consent_version: str = Field(..., min_length=1, max_length=64)
    user_agent: str | None = Field(default=None, max_length=512)


class AudioConsentStatus(BaseModel):
    consent_required_version: str
    accepted_version: str | None
    accepted_at: str | None
    needs_consent: bool


class AudioUploadUrlRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=200)
    content_type: str = Field(..., min_length=1, max_length=80)
    size_bytes: int = Field(..., gt=0)

    @field_validator("content_type")
    @classmethod
    def validate_mime(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in ALLOWED_AUDIO_MIME_TYPES:
            raise ValueError("Unsupported audio MIME type")
        return value

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Filename cannot be empty")
        return cleaned


class AudioUploadUrlResponse(BaseModel):
    upload_url: str
    key: str
    expires_in: int


class AudioTranscribeRequest(BaseModel):
    storage_key: str = Field(..., min_length=1, max_length=512)
    original_filename: str = Field(..., min_length=1, max_length=200)
    turnstile_token: str | None = None


class AudioCandidateCard(BaseModel):
    front: str
    back: str
    tag: str | None = None


class AudioCardAcceptRequest(BaseModel):
    front: str = Field(..., min_length=1, max_length=400)
    back: str = Field(..., min_length=1, max_length=2000)
    tag: str | None = Field(default=None, max_length=80)

    @field_validator("front", "back")
    @classmethod
    def strip_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Card text cannot be empty")
        return cleaned


class AudioStreamEntryResponse(BaseModel):
    id: str
    project_id: str
    entry_type: Literal["audio_transcript"]
    content: str  # the summary
    transcript: str
    duration_seconds: int
    audio_filename: str
    language: str | None = None
    language_warning: str | None = None
    candidate_cards: list[AudioCandidateCard] = Field(default_factory=list)
    created_at: str
    updated_at: str
