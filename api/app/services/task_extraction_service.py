"""Free-form task extraction.

Accepts a paste of text or an image (handwritten board, slide photo,
emailed assignment instructions, etc.) and proposes structured tasks
for the student to review. Uses a vision-capable model so a single
service handles both modes.

Confirmation-first: this service never persists tasks — it only returns
proposals. The student confirms in the UI; the existing /projects/
{id}/planning/tasks endpoint persists.
"""

import json
import logging
import time
from datetime import date
from typing import Literal

from openai import OpenAI

from app.core.config import settings
from app.services.usage_service import PRICING

logger = logging.getLogger(__name__)


VALID_PRIORITY = {"low", "medium", "high"}
VALID_CONFIDENCE = {"high", "medium", "low"}


def _compute_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    input_rate, output_rate = PRICING.get(model, (0.15, 0.60))
    return (prompt_tokens * input_rate + completion_tokens * output_rate) / 1_000_000


def _build_system_prompt(today_iso: str, course_context: list[str]) -> str:
    context_block = "\n".join(course_context) if course_context else "(no course context)"
    return f"""You extract academic to-do tasks from a paste of text or a photo of student materials.

Today's date is {today_iso}. Course context:
{context_block}

Return strict JSON only in this schema:
{{"tasks":[
  {{
    "title": "string (concise, action-oriented, <=100 chars)",
    "notes": "string or null (helpful detail, <=500 chars)",
    "due_date": "YYYY-MM-DD or null",
    "priority": "low|medium|high",
    "confidence": "high|medium|low",
    "uncertain_fields": ["field_name", ...]
  }},
  ...
]}}

Rules:
- Extract only items the student would track as tasks (assignments to do, readings to finish, problem sets, prep work, errands tied to coursework).
- Do NOT extract general announcements, schedule entries with no action, or duplicates.
- If a date is ambiguous or missing, set due_date to null and add "due_date" to uncertain_fields.
- Use today's date as the reference for relative dates ("by Friday", "next week").
- Priority: high = exam-related, major deliverable, or due within 2 days; low = reading/light prep with no firm date; medium = everything else.
- Cap at 20 proposed tasks. Prefer fewer high-quality proposals over many noisy ones."""


def extract_tasks_from_input(
    *,
    text: str | None,
    image_base64: str | None,
    course_context: list[str] | None = None,
) -> tuple[list[dict], dict]:
    """Call the LLM to extract proposed tasks. Returns (proposals, usage_meta).

    Either text or image_base64 must be provided. If both, the model gets both
    as multimodal content.
    """
    if not text and not image_base64:
        raise ValueError("Provide text or image_base64 to extract tasks")

    today_iso = date.today().isoformat()
    system_prompt = _build_system_prompt(today_iso, course_context or [])

    user_content: list[dict] = []
    if text:
        user_content.append({"type": "text", "text": text[:8000]})
    if image_base64:
        # Trust the caller to have validated size + format. The frontend will
        # cap to ~5MB before encoding; the API enforces a content-length limit
        # at the route layer.
        user_content.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{image_base64}",
                    "detail": "low",
                },
            }
        )

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    start = time.perf_counter()
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=0.1,
        response_format={"type": "json_object"},
        max_tokens=settings.OPENAI_MAX_OUTPUT_TOKENS,
        timeout=settings.OPENAI_TIMEOUT_SECONDS,
    )
    usage = response.usage
    prompt_tokens = usage.prompt_tokens if usage else 0
    completion_tokens = usage.completion_tokens if usage else 0
    logger.info(
        "Task extraction completed in %.1fs (prompt=%d, completion=%d)",
        time.perf_counter() - start,
        prompt_tokens,
        completion_tokens,
    )

    payload: dict = {}
    try:
        payload = json.loads(response.choices[0].message.content or "{}")
    except json.JSONDecodeError:
        logger.warning("Task extraction returned non-JSON content; treating as empty")

    proposals = _normalize_proposals(payload)
    return proposals, {
        "model": settings.OPENAI_MODEL,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cost_usd": _compute_cost(settings.OPENAI_MODEL, prompt_tokens, completion_tokens),
    }


def _valid_date(value) -> str | None:
    if not isinstance(value, str):
        return None
    try:
        date.fromisoformat(value)
    except ValueError:
        return None
    return value


def _normalize_proposals(payload: dict) -> list[dict]:
    items = payload.get("tasks")
    if not isinstance(items, list):
        return []
    out: list[dict] = []
    for raw in items[:20]:
        if not isinstance(raw, dict):
            continue
        title = raw.get("title")
        if not isinstance(title, str):
            continue
        title = title.strip()[:200]
        if not title:
            continue
        notes = raw.get("notes")
        notes = notes.strip()[:500] if isinstance(notes, str) and notes.strip() else None
        due_date = _valid_date(raw.get("due_date"))
        priority = raw.get("priority")
        if priority not in VALID_PRIORITY:
            priority = "medium"
        confidence = raw.get("confidence")
        if confidence not in VALID_CONFIDENCE:
            confidence = "medium"
        uncertain = raw.get("uncertain_fields") or []
        if not isinstance(uncertain, list):
            uncertain = []
        uncertain = [u for u in uncertain if isinstance(u, str)][:4]
        out.append(
            {
                "title": title,
                "notes": notes,
                "due_date": due_date,
                "priority": priority,
                "confidence": confidence,
                "uncertain_fields": uncertain,
            }
        )
    return out
