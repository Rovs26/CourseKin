"""Pydantic schemas for Phase I — timed mock exams."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


ExamDifficulty = Literal["easy", "medium", "hard", "mixed"]
ExamStatus = Literal["in_progress", "submitted", "abandoned", "expired"]
QuestionType = Literal["mcq", "short_answer", "fill_blank"]


class MockExamCreateRequest(BaseModel):
    obligation_id: str | None = None
    title: str | None = Field(default=None, max_length=200)
    difficulty: ExamDifficulty = "mixed"
    target_minutes: int = Field(default=30, ge=5, le=180)
    question_count: int = Field(default=10, ge=3, le=50)
    confidence_before: int | None = Field(default=None, ge=1, le=5)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class ExamQuestion(BaseModel):
    id: str
    type: QuestionType
    topic: str
    prompt: str
    choices: list[str] = Field(default_factory=list)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    rationale: str | None = None
    # answer intentionally omitted from in-progress responses — see service


class ExamQuestionWithAnswer(ExamQuestion):
    answer: str


class MockExamSubmitRequest(BaseModel):
    answers: dict[str, str]
    confidence_after: int | None = Field(default=None, ge=1, le=5)


QuestionVerdict = Literal["correct", "incorrect", "unverified"]


class MockExamSelfGradeRequest(BaseModel):
    question_id: str
    verdict: Literal["correct", "incorrect"]


class ExamTopicResult(BaseModel):
    topic: str
    correct: int
    total: int
    accuracy_percent: int


class MockExamSummary(BaseModel):
    id: str
    project_id: str
    obligation_id: str | None = None
    title: str
    difficulty: ExamDifficulty
    target_minutes: int
    question_count: int
    total_count: int
    correct_count: int | None = None
    score_percent: int | None = None
    started_at: str
    deadline_at: str
    submitted_at: str | None = None
    status: ExamStatus
    confidence_before: int | None = None
    confidence_after: int | None = None
    created_at: str
    updated_at: str


class MockExamSessionResponse(MockExamSummary):
    # In-progress: omit per-question `answer`; reveal on submit only.
    questions: list[ExamQuestion]
    answers: dict[str, str] = Field(default_factory=dict)
    per_topic_results: list[ExamTopicResult] = Field(default_factory=list)


class MockExamGradedResponse(MockExamSummary):
    questions: list[ExamQuestionWithAnswer]
    answers: dict[str, str] = Field(default_factory=dict)
    per_question_correct: dict[str, bool] = Field(default_factory=dict)
    per_question_verdict: dict[str, QuestionVerdict] = Field(default_factory=dict)
    unverified_count: int = 0
    per_topic_results: list[ExamTopicResult] = Field(default_factory=list)
    remedial_cards_created: int = 0


class MockExamListResponse(BaseModel):
    items: list[MockExamSummary]
    total: int
