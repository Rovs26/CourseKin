"""Extract course metadata from pasted syllabus text to prefill the wizard.

This runs *before* a project exists, so it works on raw text only (no source
chunks / storage). Returns best-effort fields; anything the syllabus doesn't
state is left null so the student can fill it in themselves.
"""

import json
import logging
import time

from openai import OpenAI

from app.core.config import settings
from app.services.usage_service import PRICING

logger = logging.getLogger(__name__)

_FIELDS = ("title", "course_code", "field_of_study", "term", "instructor", "meeting_schedule")


def _compute_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    input_rate, output_rate = PRICING.get(model, (0.15, 0.60))
    return (prompt_tokens * input_rate + completion_tokens * output_rate) / 1_000_000


def _normalize(payload: dict) -> dict:
    result: dict[str, str | None] = {}
    for field in _FIELDS:
        value = payload.get(field)
        if isinstance(value, str):
            cleaned = value.strip()
            result[field] = cleaned[:200] if cleaned else None
        else:
            result[field] = None
    return result


def extract_syllabus_metadata(text: str) -> tuple[dict, dict]:
    """Return ``(metadata, usage)`` extracted from raw syllabus text."""
    snippet = text.strip()[: settings.MAX_EXTRACTED_CHARS]
    zero_usage = {
        "model": settings.OPENAI_MODEL,
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "cost_usd": 0.0,
    }
    if not snippet:
        return ({field: None for field in _FIELDS}, zero_usage)

    system_prompt = """You extract course metadata from a syllabus for a study app.

Return strict JSON only with exactly these keys:
{"title":string|null,"course_code":string|null,"field_of_study":string|null,"term":string|null,"instructor":string|null,"meeting_schedule":string|null}

Rules:
- title: the course name (e.g. "Organic Chemistry I"), not the document title.
- course_code: the catalog code (e.g. "CHEM 101").
- field_of_study: the broad subject area (e.g. "Chemistry").
- term: the academic term as written (e.g. "First Semester, AY 2026-2027").
- instructor: the primary instructor's name.
- meeting_schedule: days/times/room as a short readable string.
- Use null for anything the syllabus does not clearly state. Never guess."""

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    started = time.perf_counter()
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Syllabus text:\n{snippet}"},
        ],
        temperature=0.0,
        response_format={"type": "json_object"},
        max_tokens=settings.OPENAI_MAX_OUTPUT_TOKENS,
        timeout=settings.OPENAI_TIMEOUT_SECONDS,
    )
    usage = response.usage
    prompt_tokens = usage.prompt_tokens if usage else 0
    completion_tokens = usage.completion_tokens if usage else 0
    logger.info("Syllabus prefill completed in %.1fs", time.perf_counter() - started)
    payload = json.loads(response.choices[0].message.content or "{}")
    return _normalize(payload), {
        "model": settings.OPENAI_MODEL,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cost_usd": _compute_cost(settings.OPENAI_MODEL, prompt_tokens, completion_tokens),
    }
