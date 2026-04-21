"""
Template presets for reviewer generation.

Each template defines which sections to generate and custom item counts.
Templates modify the generation prompt — they are shortcuts for section/count configs.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Template:
    id: str
    name: str
    description: str
    sections: list[str]
    counts: dict[str, int]


TEMPLATES: dict[str, Template] = {
    "exam-sprint": Template(
        id="exam-sprint",
        name="Exam Sprint",
        description="Fast review cycles with more quiz and flashcards.",
        sections=["summary", "key_points", "quiz", "flashcards"],
        counts={"key_points": 10, "quiz": 15, "flashcards": 25},
    ),
    "deep-study-pack": Template(
        id="deep-study-pack",
        name="Deep Study Pack",
        description="Thorough concept understanding with extended definitions and Q&A.",
        sections=["summary", "key_points", "definitions", "qa", "flashcards"],
        counts={"key_points": 20, "definitions": 15, "qa": 15, "flashcards": 20},
    ),
    "lecture-notes-cleaner": Template(
        id="lecture-notes-cleaner",
        name="Lecture Notes Cleaner",
        description="Convert messy notes into structured key points and definitions.",
        sections=["summary", "key_points", "definitions"],
        counts={"key_points": 20, "definitions": 15},
    ),
    "compare-sources": Template(
        id="compare-sources",
        name="Compare Sources",
        description="Combine multiple materials into one reviewer with quiz focus.",
        sections=["summary", "key_points", "qa", "quiz"],
        counts={"key_points": 15, "qa": 10, "quiz": 10},
    ),
}


def get_template(template_id: str) -> Template | None:
    return TEMPLATES.get(template_id)


def list_templates() -> list[Template]:
    return list(TEMPLATES.values())
