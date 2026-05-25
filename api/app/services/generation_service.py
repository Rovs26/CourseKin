import hashlib
import json
import logging
import time

from openai import OpenAI

from app.core.config import settings
from app.core.utils import utc_now_iso
from app.db.database import SessionLocal
from app.db.models import Job, Reviewer, GenerationCache

logger = logging.getLogger(__name__)

PROMPT_VERSION = "v1"

# Pricing per million tokens: (input_usd, output_usd)
PRICING: dict[str, tuple[float, float]] = {
    "gpt-4.1-nano": (0.10, 0.40),
    "gpt-4o-mini":  (0.15, 0.60),
    "gpt-4.1-mini": (0.40, 1.60),
}

ALL_SECTIONS = ["summary", "key_points", "definitions", "qa", "quiz", "flashcards"]

DEFAULT_COUNTS = {
    "key_points": 12,
    "definitions": 10,
    "qa": 10,
    "quiz": 8,
    "flashcards": 15,
}

SECTION_SCHEMA = {
    "summary": '"summary": "string"',
    "key_points": '"key_points": ["string"]',
    "definitions": '"definitions": [{"term": "string", "definition": "string"}]',
    "qa": '"qa": [{"question": "string", "answer": "string"}]',
    "quiz": '"quiz": [{"question": "string", "choices": ["string"], "answer": "string", "rationale": "string"}]',
    "flashcards": '"flashcards": [{"front": "string", "back": "string"}]',
}

SECTION_INSTRUCTIONS = {
    "summary": "Produce a full study summary, not a short abstract. Make it detailed enough to review the topic without rereading the source.",
    "key_points": "Extract key testable concepts that are directly and explicitly stated in the source text. Do not include facts, trivia, or information not present in the source. Focus on concepts the student needs to know to pass an exam on this specific material.",
    "definitions": "Include every important term from the source that a student may need to memorize or explain.",
    "qa": "Create substantial study questions and direct model answers. Questions should help with recall, explanation, and understanding.",
    "quiz": "Create multiple choice items that test core understanding. Make the distractors plausible but still grounded in the source.",
    "flashcards": "Create memorization ready flashcards for facts, concepts, and relationships.",
}


def _build_prompt(sections: list[str], counts: dict[str, int]) -> tuple[str, str]:
    """Build system and user prompts for the given sections and counts."""

    schema_parts = [SECTION_SCHEMA[s] for s in sections]
    schema_str = "{\n  " + ",\n  ".join(schema_parts) + "\n}"

    section_instructions = []
    for s in sections:
        instruction = SECTION_INSTRUCTIONS[s]
        if s in counts and s != "summary":
            instruction += f"\nGenerate exactly {counts[s]} items."
        section_instructions.append(f"- {s}: {instruction}")

    excluded = [s for s in ALL_SECTIONS if s not in sections]
    exclusion_note = ""
    if excluded:
        exclusion_note = f"\nDo NOT generate these sections: {', '.join(excluded)}. Only return the sections listed above."

    system_prompt = f"""You are an expert academic reviewer builder for exam preparation.

Your task is to convert the user's source text into a deeply comprehensive reviewer for serious study and exam mastery.

Rules:
Use the source text only. Do not invent or include facts not explicitly stated in the source.
Do not add trivia, fun facts, or general knowledge that is not in the source material.
Be thorough and exhaustive within the source material.
Aim for high study value, not brevity.
Write clearly and concretely for students.
Avoid filler.
Return strict JSON only.
Do not wrap the JSON in markdown.

Output schema (return ONLY these fields):
{schema_str}

Section requirements:
{chr(10).join(section_instructions)}
{exclusion_note}

Quality bar:
The reviewer should feel exam ready, comprehensive, and useful for intensive study.
Every item must be traceable to the source text provided."""

    user_prompt = """Convert the text below into a comprehensive exam reviewer.

Requirements:
Fill every requested section with useful content.
Use the source text only — do not add information from outside the source.
Return strict JSON only.
Do not leave fields empty.
Be as extensive and study oriented as possible.
Stay strictly grounded in the provided text.

Source text:
{source_text}"""

    return system_prompt, user_prompt


def _compute_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Compute USD cost for an OpenAI call based on token counts and model pricing."""
    input_rate, output_rate = PRICING.get(model, (0.15, 0.60))  # fallback to gpt-4o-mini rates
    return (prompt_tokens * input_rate + completion_tokens * output_rate) / 1_000_000


def _call_openai(
    source_text: str,
    sections: list[str],
    counts: dict[str, int],
) -> tuple[dict, dict]:
    """Call OpenAI and return (parsed_content, usage_info).

    usage_info keys: model, prompt_tokens, completion_tokens, cost_usd
    """
    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    # Hard cap on source text before sending to OpenAI
    if len(source_text) > settings.MAX_EXTRACTED_CHARS:
        source_text = source_text[: settings.MAX_EXTRACTED_CHARS]

    system_prompt, user_prompt_template = _build_prompt(sections, counts)

    logger.info(
        "OpenAI call: model=%s sections=%s source_chars=%d",
        settings.OPENAI_MODEL,
        sections,
        len(source_text),
    )
    start = time.perf_counter()

    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt_template.format(source_text=source_text)},
        ],
        temperature=0.3,
        response_format={"type": "json_object"},
        max_tokens=settings.OPENAI_MAX_OUTPUT_TOKENS,
        timeout=settings.OPENAI_TIMEOUT_SECONDS,
    )

    elapsed = time.perf_counter() - start
    usage = response.usage

    prompt_tokens = usage.prompt_tokens if usage else 0
    completion_tokens = usage.completion_tokens if usage else 0
    cost_usd = _compute_cost(settings.OPENAI_MODEL, prompt_tokens, completion_tokens)

    logger.info(
        "OpenAI response: %.1fs tokens_in=%d tokens_out=%d cost_usd=%.6f",
        elapsed,
        prompt_tokens,
        completion_tokens,
        cost_usd,
    )

    raw = response.choices[0].message.content or ""
    content = json.loads(raw)

    usage_info = {
        "model": settings.OPENAI_MODEL,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cost_usd": cost_usd,
    }

    return content, usage_info


LIST_SECTIONS = {"key_points", "definitions", "qa", "quiz", "flashcards"}


def _merge_content(
    existing: dict | None,
    new_content: dict,
    sections: list[str],
    source_id: str,
    merge_mode: str = "skip",
) -> dict:
    """Merge new partial content into existing content.

    merge_mode controls how existing sections are handled:
      "skip"    — Additive. Only fills sections that don't already have content.
      "replace" — Overwrites requested sections with new content.
      "append"  — For list sections (key_points, definitions, qa, quiz, flashcards),
                  concatenates new items after existing items.
                  For summary (non-list), replaces with the new one.

    Always updates _meta.sources to track which source(s) own each section.
    For append mode, sources is a list of contributing source IDs per section.
    """
    if existing is None:
        existing = {}

    merged = dict(existing)
    meta = dict(merged.get("_meta", {}).get("sources", {}))

    for section in sections:
        if section not in new_content:
            continue

        has_existing = section in merged and merged[section]

        if merge_mode == "skip" and has_existing:
            continue

        if merge_mode == "append" and has_existing and section in LIST_SECTIONS:
            # Concatenate list items
            old_items = merged[section] if isinstance(merged[section], list) else []
            new_items = new_content[section] if isinstance(new_content[section], list) else []
            merged[section] = old_items + new_items

            # Track multiple sources per section
            existing_sources = meta.get(section)
            if isinstance(existing_sources, list):
                if source_id not in existing_sources:
                    meta[section] = existing_sources + [source_id]
            elif isinstance(existing_sources, str):
                if existing_sources != source_id:
                    meta[section] = [existing_sources, source_id]
                else:
                    meta[section] = [source_id]
            else:
                meta[section] = [source_id]
        else:
            # Replace or first-fill
            merged[section] = new_content[section]
            meta[section] = [source_id]

    merged["_meta"] = {"sources": meta}
    return merged


def _resolve_sections_and_counts(
    sections: list[str] | None,
    counts_input: dict | None,
) -> tuple[list[str], dict[str, int]]:
    """Normalize sections list and counts dict."""
    if sections is None:
        sections = list(ALL_SECTIONS)
    else:
        sections = [s for s in sections if s in ALL_SECTIONS]
        if not sections:
            sections = list(ALL_SECTIONS)

    counts = dict(DEFAULT_COUNTS)
    if counts_input:
        for key, value in counts_input.items():
            if value is not None and key in DEFAULT_COUNTS:
                counts[key] = value

    return sections, counts


def _compute_cache_key(
    source_text: str,
    model: str,
    sections: list[str],
    counts: dict[str, int],
    prompt_version: str,
    user_id: str | None,
) -> str:
    """Compute a stable SHA256 cache key for the generation inputs."""
    payload = json.dumps(
        {
            "source_text": source_text,
            "model": model,
            "sections": sorted(sections),
            "counts": {k: counts[k] for k in sorted(counts)},
            "prompt_version": prompt_version,
            "user_id": user_id,
        },
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def run_generation_in_background(
    job_id: str,
    project_id: str,
    source_id: str,
    source_text: str,
    user_id: str | None = None,
    sections: list[str] | None = None,
    counts: dict | None = None,
    merge_mode: str = "skip",
):
    resolved_sections, resolved_counts = _resolve_sections_and_counts(sections, counts)

    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if not job:
            return

        # Mark job as actively generating
        job.stage = "generating"
        job.updated_at = utc_now_iso()
        db.commit()

        # ── Cache check ───────────────────────────────────────────────────────
        cache_key = _compute_cache_key(
            source_text=source_text,
            model=settings.OPENAI_MODEL,
            sections=resolved_sections,
            counts=resolved_counts,
            prompt_version=PROMPT_VERSION,
            user_id=user_id,
        )
        cached_entry = (
            db.query(GenerationCache)
            .filter(
                GenerationCache.cache_key == cache_key,
                GenerationCache.user_id == user_id,
            )
            .first()
        )

        content_json: dict | None = None
        usage_info: dict | None = None
        cache_hit = False

        if cached_entry:
            cache_hit = True
            content_json = cached_entry.content_json
            cached_entry.hit_count += 1
            cached_entry.last_hit_at = utc_now_iso()
            db.commit()
            logger.info("Cache hit: job=%s key=%.12s...", job_id, cache_key)
        else:
            try:
                content_json, usage_info = _call_openai(source_text, resolved_sections, resolved_counts)
            except Exception as e:
                logger.error("Generation failed: job=%s error=%s", job_id, e)
                job.status = "failed"
                job.stage = "failed"
                job.error_message = str(e)
                job.updated_at = utc_now_iso()
                db.commit()
                if user_id:
                    from app.services.usage_service import release_reserved_cost
                    release_reserved_cost(db, user_id, job_id)
                return

            # Store result in cache
            try:
                from uuid import uuid4
                cache_row = GenerationCache(
                    id=str(uuid4()),
                    user_id=user_id,
                    cache_key=cache_key,
                    content_json=content_json,
                    model=settings.OPENAI_MODEL,
                    prompt_version=PROMPT_VERSION,
                    hit_count=0,
                    created_at=utc_now_iso(),
                    last_hit_at=None,
                )
                db.add(cache_row)
                db.commit()
            except Exception as e:
                # Non-fatal: cache write failure should not break the job
                logger.warning("Cache write failed: job=%s error=%s", job_id, e)
                db.rollback()

        if user_id:
            try:
                from app.services.usage_service import record_usage  # avoid circular import
                if cache_hit:
                    record_usage(
                        db=db,
                        user_id=user_id,
                        job_id=job_id,
                        model=settings.OPENAI_MODEL,
                        prompt_tokens=0,
                        completion_tokens=0,
                        cost_usd=0.0,
                        cached=True,
                    )
                elif usage_info:
                    record_usage(
                        db=db,
                        user_id=user_id,
                        job_id=job_id,
                        model=usage_info["model"],
                        prompt_tokens=usage_info["prompt_tokens"],
                        completion_tokens=usage_info["completion_tokens"],
                        cost_usd=usage_info["cost_usd"],
                    )
            except Exception as e:
                # Non-fatal: log but don't fail the job
                logger.warning("Failed to record usage: job=%s error=%s", job_id, e)

        now = utc_now_iso()

        reviewer = db.get(Reviewer, project_id)
        if reviewer:
            existing_content = reviewer.content_json if isinstance(reviewer.content_json, dict) else {}
            merged = _merge_content(existing_content, content_json, resolved_sections, source_id, merge_mode)
            reviewer.source_id = source_id
            reviewer.status = "ready"
            reviewer.output_type = "full-reviewer"
            reviewer.content_json = merged
            reviewer.updated_at = now
        else:
            # Track which source generated each section (always list format)
            meta = {s: [source_id] for s in resolved_sections if s in content_json}
            content_json["_meta"] = {"sources": meta}

            reviewer = Reviewer(
                project_id=project_id,
                source_id=source_id,
                status="ready",
                output_type="full-reviewer",
                version=1,
                content_json=content_json,
                created_at=now,
                updated_at=now,
            )
            db.add(reviewer)

        job.status = "completed"
        job.stage = "completed"
        job.error_message = None
        job.updated_at = now
        db.commit()

        logger.info("Generation completed: job=%s project=%s", job_id, project_id)

    except Exception as e:
        try:
            job = db.get(Job, job_id)
            if job:
                job.status = "failed"
                job.stage = "failed"
                job.error_message = f"Unexpected error: {str(e)}"
                job.updated_at = utc_now_iso()
                db.commit()
                if user_id:
                    from app.services.usage_service import release_reserved_cost
                    release_reserved_cost(db, user_id, job_id)
        except Exception:
            pass
    finally:
        db.close()
