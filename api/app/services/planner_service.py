"""Natural-language day planner.

Turns a free-text dump of intentions ("exercise an hour tonight, study 3 hours,
review for my exam next week, do a shop") into structured, time-blocked
suggestions that slot around the student's already-planned study sessions.

Confirmation-first: this service never persists blocks. It returns suggested
PlannerBlock-shaped dicts with proposed start times; the student reviews and
confirms in the UI, and the planner route persists the accepted blocks.
"""

import json
import logging
import time
from datetime import date, datetime, timedelta
from typing import Iterable

from openai import OpenAI

from app.core.config import settings
from app.services.usage_service import PRICING

logger = logging.getLogger(__name__)

VALID_KIND = {"study", "review", "exercise", "errand", "personal", "other"}
VALID_TIME_OF_DAY = {"morning", "afternoon", "evening", "night", "any"}

# Default start-of-window per loose time-of-day hint (24h local).
TIME_OF_DAY_WINDOWS = {
    "morning": (8 * 60, 12 * 60),
    "afternoon": (12 * 60, 17 * 60),
    "evening": (17 * 60, 21 * 60),
    "night": (20 * 60, 23 * 60),
    "any": (8 * 60, 21 * 60),
}

# How long the suggested day runs when placing "any"-time blocks.
DAY_START_MIN = 8 * 60
DAY_END_MIN = 23 * 60


def _compute_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    input_rate, output_rate = PRICING.get(model, (0.15, 0.60))
    return (prompt_tokens * input_rate + completion_tokens * output_rate) / 1_000_000


def _build_system_prompt(today_iso: str) -> str:
    return f"""You convert a student's free-text plans for their day/week into structured time blocks.

Today's date is {today_iso}.

Return strict JSON only in this schema:
{{"blocks":[
  {{
    "title": "string (concise, <=100 chars)",
    "kind": "study|review|exercise|errand|personal|other",
    "date": "YYYY-MM-DD",
    "duration_minutes": integer (15-480),
    "time_of_day": "morning|afternoon|evening|night|any",
    "notes": "string or null (<=300 chars)"
  }},
  ...
]}}

Rules:
- One block per distinct intention. Split clearly separate activities.
- Resolve relative dates against today ("tonight" = today, "next week" = pick a sensible weekday next week).
- "study"/"review" for academic work; "exercise" for workouts; "errand" for shopping/chores; "personal" otherwise.
- Map loose timing words to time_of_day ("tonight"/"at night" -> night, "this morning" -> morning). Default to "any" when unspecified.
- If a duration is stated ("for an hour", "3 hours"), convert to minutes. Otherwise estimate a sensible default (study 60, review 45, exercise 60, errand 45, personal 30).
- Cap at 12 blocks. Do not invent activities the student did not mention."""


def parse_plan_text(text: str) -> tuple[list[dict], dict]:
    """Call the LLM to parse free text into block intentions.

    Returns (blocks, usage_meta). Blocks are normalized but NOT yet assigned a
    concrete start_time — scheduling happens in suggest_schedule().
    """
    if not text or not text.strip():
        raise ValueError("Provide text to parse a plan")

    today_iso = date.today().isoformat()
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    start = time.perf_counter()
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": _build_system_prompt(today_iso)},
            {"role": "user", "content": text[:4000]},
        ],
        temperature=0.2,
        response_format={"type": "json_object"},
        max_tokens=settings.OPENAI_MAX_OUTPUT_TOKENS,
        timeout=settings.OPENAI_TIMEOUT_SECONDS,
    )
    usage = response.usage
    prompt_tokens = usage.prompt_tokens if usage else 0
    completion_tokens = usage.completion_tokens if usage else 0
    logger.info(
        "Plan parse completed in %.1fs (prompt=%d, completion=%d)",
        time.perf_counter() - start,
        prompt_tokens,
        completion_tokens,
    )

    payload: dict = {}
    try:
        payload = json.loads(response.choices[0].message.content or "{}")
    except json.JSONDecodeError:
        logger.warning("Plan parse returned non-JSON content; treating as empty")

    blocks = _normalize_blocks(payload)
    return blocks, {
        "model": settings.OPENAI_MODEL,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cost_usd": _compute_cost(settings.OPENAI_MODEL, prompt_tokens, completion_tokens),
    }


def _build_chat_system_prompt(today_iso: str, context: str) -> str:
    return f"""You are CourseKin, a warm, sharp study companion for a university student. \
Depending on what they say, act as any of: a tutor explaining a concept, an academic \
advisor helping them decide what to work on, a study buddy keeping them motivated, or a \
day planner turning their intentions into a timetable.

Today's date is {today_iso}.

What you know about this student right now:
{context}

Decide a mode for each reply:
- "plan": use this ONLY when the student wants you to schedule or time-block their day/week \
(e.g. "plan my day", "fit these into my schedule", or they list activities to do with rough \
durations/times). Then propose concrete blocks.
- "reply": use this for everything else — answering "what should I do next?", explaining a \
topic, advice, encouragement, or general chat. Ground answers in their context above when relevant.

Return strict JSON only:
{{
  "mode": "plan" | "reply",
  "reply": "a concise, friendly message to show the student (always present)",
  "blocks": [
    {{
      "title": "string (<=100 chars)",
      "kind": "study|review|exercise|errand|personal|other",
      "date": "YYYY-MM-DD",
      "duration_minutes": integer (15-480),
      "time_of_day": "morning|afternoon|evening|night|any",
      "notes": "string or null (<=300 chars)"
    }}
  ]
}}

Rules:
- "blocks" must be an empty array unless mode is "plan".
- In "plan" mode: one block per distinct intention (max 12), resolve relative dates against \
today, map timing words to time_of_day, convert stated durations to minutes (else estimate: \
study 60, review 45, exercise 60, errand 45, personal 30). Keep "reply" short — say you've \
drafted a timetable to review.
- Never invent activities the student did not mention.
- Keep replies brief (a few sentences), specific, and encouraging."""


def chat_with_assistant(
    message: str, history: list[dict], context: str
) -> tuple[dict, dict]:
    """Single-call study assistant. Classifies intent and either replies
    conversationally or proposes a plan.

    Returns (result, usage_meta) where result = {"mode", "reply", "blocks"}.
    Blocks are normalized (not yet scheduled) — the route runs suggest_schedule
    when mode is "plan".
    """
    if not message or not message.strip():
        raise ValueError("Type a message")

    today_iso = date.today().isoformat()
    chat_messages = [
        {"role": "system", "content": _build_chat_system_prompt(today_iso, context)},
    ]
    # Keep the last few turns for continuity; cap content length.
    for turn in history[-8:]:
        role = turn.get("role")
        content = turn.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            chat_messages.append({"role": role, "content": content[:2000]})
    chat_messages.append({"role": "user", "content": message[:4000]})

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    start = time.perf_counter()
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=chat_messages,
        temperature=0.4,
        response_format={"type": "json_object"},
        max_tokens=settings.OPENAI_MAX_OUTPUT_TOKENS,
        timeout=settings.OPENAI_TIMEOUT_SECONDS,
    )
    usage = response.usage
    prompt_tokens = usage.prompt_tokens if usage else 0
    completion_tokens = usage.completion_tokens if usage else 0
    logger.info(
        "Assistant chat completed in %.1fs (prompt=%d, completion=%d)",
        time.perf_counter() - start,
        prompt_tokens,
        completion_tokens,
    )

    payload: dict = {}
    try:
        payload = json.loads(response.choices[0].message.content or "{}")
    except json.JSONDecodeError:
        logger.warning("Assistant chat returned non-JSON content; treating as reply")

    mode = payload.get("mode")
    reply = payload.get("reply")
    if not isinstance(reply, str) or not reply.strip():
        reply = "I'm here to help — ask me to plan your day, suggest what to work on, or explain a topic."
    blocks = _normalize_blocks(payload) if mode == "plan" else []
    if mode != "plan":
        mode = "reply"

    result = {"mode": mode, "reply": reply.strip()[:2000], "blocks": blocks}
    usage_meta = {
        "model": settings.OPENAI_MODEL,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cost_usd": _compute_cost(settings.OPENAI_MODEL, prompt_tokens, completion_tokens),
    }
    return result, usage_meta


def _valid_date(value) -> str | None:
    if not isinstance(value, str):
        return None
    try:
        date.fromisoformat(value)
    except ValueError:
        return None
    return value


def _normalize_blocks(payload: dict) -> list[dict]:
    items = payload.get("blocks")
    if not isinstance(items, list):
        return []
    today_iso = date.today().isoformat()
    out: list[dict] = []
    for raw in items[:12]:
        if not isinstance(raw, dict):
            continue
        title = raw.get("title")
        if not isinstance(title, str) or not title.strip():
            continue
        title = title.strip()[:100]
        kind = raw.get("kind")
        if kind not in VALID_KIND:
            kind = "personal"
        scheduled_date = _valid_date(raw.get("date")) or today_iso
        try:
            duration = int(raw.get("duration_minutes", 30))
        except (TypeError, ValueError):
            duration = 30
        duration = max(15, min(duration, 480))
        time_of_day = raw.get("time_of_day")
        if time_of_day not in VALID_TIME_OF_DAY:
            time_of_day = "any"
        notes = raw.get("notes")
        notes = notes.strip()[:300] if isinstance(notes, str) and notes.strip() else None
        out.append(
            {
                "title": title,
                "kind": kind,
                "scheduled_date": scheduled_date,
                "duration_minutes": duration,
                "time_of_day": time_of_day,
                "notes": notes,
            }
        )
    return out


def _to_minutes(hhmm: str) -> int | None:
    try:
        hh, mm = hhmm.split(":")
        return int(hh) * 60 + int(mm)
    except (ValueError, AttributeError):
        return None


def _to_hhmm(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _first_free_slot(
    busy: list[tuple[int, int]], window_start: int, window_end: int, duration: int
) -> int | None:
    """Find the earliest start within [window_start, window_end] of `duration`
    minutes that doesn't overlap any busy interval. `busy` is a sorted list of
    (start, end) minute intervals."""
    cursor = window_start
    for b_start, b_end in busy:
        if b_end <= cursor:
            continue
        if b_start >= window_end:
            break
        if b_start - cursor >= duration:
            return cursor
        cursor = max(cursor, b_end)
    if window_end - cursor >= duration:
        return cursor
    return None


def suggest_schedule(
    blocks: list[dict], existing_busy: dict[str, Iterable[tuple[int, int]]]
) -> list[dict]:
    """Assign a concrete start_time to each parsed block, avoiding overlap with
    existing busy intervals (and with each other).

    `existing_busy` maps a date string to an iterable of (start_min, end_min)
    intervals already occupied that day (e.g. planned study sessions). Blocks
    that can't be fit keep start_time=None (the student can place them manually).
    Returns blocks augmented with `start_time` and `conflict` flag.
    """
    # Per-day working copy of busy intervals, kept sorted.
    occupied: dict[str, list[tuple[int, int]]] = {
        day: sorted(intervals) for day, intervals in existing_busy.items()
    }

    # Place fixed-window (non-"any") blocks first so loose ones fill the gaps.
    ordered = sorted(blocks, key=lambda b: b["time_of_day"] == "any")

    suggestions: list[dict] = []
    for block in ordered:
        day = block["scheduled_date"]
        day_busy = occupied.setdefault(day, [])
        win_start, win_end = TIME_OF_DAY_WINDOWS[block["time_of_day"]]
        duration = block["duration_minutes"]

        start = _first_free_slot(day_busy, win_start, win_end, duration)
        # Fall back to the whole day if the preferred window is full.
        if start is None and block["time_of_day"] != "any":
            start = _first_free_slot(day_busy, DAY_START_MIN, DAY_END_MIN, duration)

        suggestion = dict(block)
        if start is None:
            suggestion["start_time"] = None
            suggestion["conflict"] = True
        else:
            suggestion["start_time"] = _to_hhmm(start)
            suggestion["conflict"] = False
            day_busy.append((start, start + duration))
            day_busy.sort()
        suggestions.append(suggestion)

    return suggestions


def busy_from_sessions(
    sessions: list[dict], *, default_start_min: int = DAY_START_MIN
) -> dict[str, list[tuple[int, int]]]:
    """Build a per-day busy map from existing planned items.

    Each session dict needs `scheduled_date` and `estimated_minutes`; optional
    `start_time` (HH:MM). Sessions without a start time are stacked from the
    start of the day so loose study sessions still reserve space.
    """
    busy: dict[str, list[tuple[int, int]]] = {}
    cursor_by_day: dict[str, int] = {}
    for session in sessions:
        day = session.get("scheduled_date")
        if not day:
            continue
        duration = int(session.get("estimated_minutes") or 30)
        start_time = session.get("start_time")
        start_min = _to_minutes(start_time) if start_time else None
        if start_min is None:
            start_min = cursor_by_day.get(day, default_start_min)
            cursor_by_day[day] = start_min + duration
        busy.setdefault(day, []).append((start_min, start_min + duration))
    return busy
