"""Audio E1 — Whisper transcription + short notes-style summary.

Per docs/audio_e1_design.md. Two steps:
1. Whisper-1 transcribes the uploaded audio file (downloaded from R2 by the
   worker).
2. gpt-4o-mini drafts a short notes-style summary plus 3–5 candidate
   notebook cards. The cards are *proposals* — student approves before
   they persist (confirmation-first).

This module is the equivalent of `task_extraction_service.py` for audio.
It deliberately keeps no shared state; the route layer composes it.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Iterable

from openai import OpenAI

from app.core.config import settings
from app.services.usage_service import PRICING

logger = logging.getLogger(__name__)


# Whisper pricing is per minute, not per token. As of writing: $0.006/min.
WHISPER_USD_PER_MINUTE = 0.006


def _compute_summary_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    input_rate, output_rate = PRICING.get(model, (0.15, 0.60))
    return (prompt_tokens * input_rate + completion_tokens * output_rate) / 1_000_000


def transcribe_audio_bytes(
    *,
    filename: str,
    audio_bytes: bytes,
    language_hint: str | None = None,
) -> tuple[str, dict]:
    """Send audio bytes to Whisper. Returns (transcript_text, usage_meta).

    `language_hint` accepts ISO-639-1 (e.g. "en", "fil"). When omitted Whisper
    auto-detects.
    """
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    start = time.perf_counter()
    response = client.audio.transcriptions.create(
        model=settings.AUDIO_WHISPER_MODEL,
        file=(filename, audio_bytes),
        response_format="verbose_json",
        language=language_hint or None,
        timeout=settings.OPENAI_TIMEOUT_SECONDS,
    )
    elapsed = time.perf_counter() - start
    # The verbose_json payload includes a `duration` field in seconds.
    duration_seconds = float(getattr(response, "duration", 0.0) or 0.0)
    text = getattr(response, "text", "") or ""
    detected_language = getattr(response, "language", None)
    cost = (duration_seconds / 60.0) * WHISPER_USD_PER_MINUTE
    logger.info(
        "Whisper transcription completed in %.1fs (audio %.0fs, lang=%s)",
        elapsed,
        duration_seconds,
        detected_language,
    )
    return text, {
        "model": settings.AUDIO_WHISPER_MODEL,
        "duration_seconds": int(round(duration_seconds)),
        "language": detected_language,
        "cost_usd": round(cost, 4),
        # Whisper has no token concept; pass zeros so record_usage stays uniform.
        "prompt_tokens": 0,
        "completion_tokens": 0,
    }


def _summary_system_prompt() -> str:
    return (
        "You take the raw transcript of a single university lecture and produce "
        "a short, student-facing notes summary plus 3 to 5 candidate flashcards. "
        "Return strict JSON with this shape:\n"
        '{"summary":"string (markdown bullets allowed, <= 1500 chars)",'
        '"cards":[{"front":"string","back":"string","tag":"string or null"}],'
        '"language_warning":"string or null"}\n'
        "Rules:\n"
        "- The summary should highlight what was actually said in class, not "
        "invent context. Keep it under 1500 characters.\n"
        "- Each flashcard front is a single question. Back is the answer in "
        "the speaker's own framing.\n"
        "- Use a short lowercase topic tag (1-3 words) per card when the "
        "transcript supports one; otherwise null.\n"
        "- If the transcript is in a language other than English or Filipino, "
        "set language_warning to a short note like \"Detected language is "
        "Spanish — summary may be lower quality.\" Otherwise null.\n"
        "- Do not produce more than 5 cards. Do not fabricate facts not in "
        "the transcript."
    )


def summarize_transcript(
    transcript: str,
    *,
    course_context: Iterable[str] | None = None,
) -> tuple[dict, dict]:
    """Return (parsed_payload, usage_meta).

    parsed_payload schema: {"summary": str, "cards": list, "language_warning": str|None}
    """
    excerpt = transcript[: settings.MAX_EXTRACTED_CHARS]
    context_lines = list(course_context or [])
    user_prompt = "\n".join(context_lines) + "\n\nLecture transcript:\n" + excerpt

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    start = time.perf_counter()
    response = client.chat.completions.create(
        model=settings.AUDIO_SUMMARY_MODEL,
        messages=[
            {"role": "system", "content": _summary_system_prompt()},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
        max_tokens=settings.OPENAI_MAX_OUTPUT_TOKENS,
        timeout=settings.OPENAI_TIMEOUT_SECONDS,
    )
    logger.info(
        "Audio summary completed in %.1fs", time.perf_counter() - start
    )
    usage = response.usage
    prompt_tokens = usage.prompt_tokens if usage else 0
    completion_tokens = usage.completion_tokens if usage else 0
    cost = _compute_summary_cost(
        settings.AUDIO_SUMMARY_MODEL, prompt_tokens, completion_tokens
    )

    raw = response.choices[0].message.content or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {"summary": "", "cards": [], "language_warning": None}

    cleaned = _normalize_summary_payload(parsed)
    return cleaned, {
        "model": settings.AUDIO_SUMMARY_MODEL,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cost_usd": round(cost, 5),
    }


def _normalize_summary_payload(payload: dict) -> dict:
    summary_raw = payload.get("summary")
    summary = summary_raw.strip()[:1500] if isinstance(summary_raw, str) else ""
    warning_raw = payload.get("language_warning")
    warning = (
        warning_raw.strip()[:300]
        if isinstance(warning_raw, str) and warning_raw.strip()
        else None
    )
    cards_raw = payload.get("cards")
    cards: list[dict] = []
    if isinstance(cards_raw, list):
        for raw in cards_raw[:5]:
            if not isinstance(raw, dict):
                continue
            front = raw.get("front")
            back = raw.get("back")
            if not isinstance(front, str) or not isinstance(back, str):
                continue
            front_clean = front.strip()[:500]
            back_clean = back.strip()[:1500]
            if not front_clean or not back_clean:
                continue
            tag_raw = raw.get("tag")
            tag = None
            if isinstance(tag_raw, str):
                t = tag_raw.strip().lower()[:60]
                tag = t or None
            cards.append({"front": front_clean, "back": back_clean, "tag": tag})
    return {"summary": summary, "cards": cards, "language_warning": warning}
