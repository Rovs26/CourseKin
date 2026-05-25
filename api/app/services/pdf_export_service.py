"""
PDF export for reviewer content using reportlab.
Generates a styled, multi-section PDF from content_json.
"""

import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)


INDIGO = colors.HexColor("#4f46e5")
SLATE_700 = colors.HexColor("#334155")
SLATE_500 = colors.HexColor("#64748b")
SLATE_100 = colors.HexColor("#f1f5f9")


def _build_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        "CoverTitle",
        parent=styles["Title"],
        fontSize=28,
        leading=34,
        textColor=INDIGO,
        spaceAfter=6 * mm,
    ))

    styles.add(ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Normal"],
        fontSize=12,
        textColor=SLATE_500,
        spaceAfter=2 * mm,
    ))

    styles.add(ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        textColor=INDIGO,
        spaceBefore=8 * mm,
        spaceAfter=4 * mm,
    ))

    styles.add(ParagraphStyle(
        "ItemBody",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=SLATE_700,
        spaceAfter=2 * mm,
    ))

    styles.add(ParagraphStyle(
        "ItemLabel",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=INDIGO,
        spaceAfter=1 * mm,
    ))

    styles.add(ParagraphStyle(
        "QuizChoice",
        parent=styles["Normal"],
        fontSize=10,
        leading=13,
        textColor=SLATE_700,
        leftIndent=8 * mm,
    ))

    return styles


def _add_summary(elements, content, styles):
    summary = content.get("summary")
    if not summary:
        return
    elements.append(Paragraph("Summary", styles["SectionTitle"]))
    for paragraph in summary.split("\n"):
        paragraph = paragraph.strip()
        if paragraph:
            elements.append(Paragraph(paragraph, styles["ItemBody"]))
            elements.append(Spacer(1, 2 * mm))


def _add_key_points(elements, content, styles):
    points = content.get("key_points")
    if not points:
        return
    elements.append(Paragraph("Key Points", styles["SectionTitle"]))
    for i, point in enumerate(points, 1):
        elements.append(Paragraph(f"<b>{i}.</b> {point}", styles["ItemBody"]))


def _add_definitions(elements, content, styles):
    defs = content.get("definitions")
    if not defs:
        return
    elements.append(Paragraph("Definitions", styles["SectionTitle"]))
    for i, item in enumerate(defs, 1):
        term = item.get("term", "")
        definition = item.get("definition", "")
        elements.append(Paragraph(f"<b>{i}. {term}</b>", styles["ItemLabel"]))
        elements.append(Paragraph(definition, styles["ItemBody"]))
        elements.append(Spacer(1, 1 * mm))


def _add_qa(elements, content, styles):
    qa = content.get("qa")
    if not qa:
        return
    elements.append(Paragraph("Q&A", styles["SectionTitle"]))
    for i, item in enumerate(qa, 1):
        question = item.get("question", "")
        answer = item.get("answer", "")
        elements.append(Paragraph(f"<b>{i}. Q:</b> {question}", styles["ItemLabel"]))
        elements.append(Paragraph(f"<b>A:</b> {answer}", styles["ItemBody"]))
        elements.append(Spacer(1, 2 * mm))


def _add_quiz(elements, content, styles):
    quiz = content.get("quiz")
    if not quiz:
        return
    elements.append(Paragraph("Quiz", styles["SectionTitle"]))
    for i, item in enumerate(quiz, 1):
        question = item.get("question", "")
        choices = item.get("choices", [])
        answer = item.get("answer", "")
        rationale = item.get("rationale", "")

        elements.append(Paragraph(f"<b>{i}. {question}</b>", styles["ItemLabel"]))
        for j, choice in enumerate(choices):
            letter = chr(65 + j)
            elements.append(Paragraph(f"{letter}. {choice}", styles["QuizChoice"]))
        elements.append(Spacer(1, 1 * mm))
        elements.append(Paragraph(f"<b>Answer:</b> {answer}", styles["ItemBody"]))
        if rationale:
            elements.append(Paragraph(f"<i>Rationale: {rationale}</i>", styles["ItemBody"]))
        elements.append(Spacer(1, 3 * mm))


def _add_flashcards(elements, content, styles):
    cards = content.get("flashcards")
    if not cards:
        return
    elements.append(Paragraph("Flashcards", styles["SectionTitle"]))

    table_data = [["#", "Front", "Back"]]
    for i, card in enumerate(cards, 1):
        front = card.get("front", "")
        back = card.get("back", "")
        table_data.append([str(i), Paragraph(front, styles["ItemBody"]), Paragraph(back, styles["ItemBody"])])

    col_widths = [10 * mm, 75 * mm, 75 * mm]
    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INDIGO),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SLATE_100]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))

    elements.append(table)


DEFAULT_SECTION_ORDER = ["summary", "key_points", "definitions", "qa", "quiz", "flashcards"]

SECTION_BUILDERS = {
    "summary": _add_summary,
    "key_points": _add_key_points,
    "definitions": _add_definitions,
    "qa": _add_qa,
    "quiz": _add_quiz,
    "flashcards": _add_flashcards,
}


def generate_reviewer_pdf(
    project_title: str,
    field_of_study: str,
    version: int,
    content: dict,
    template_name: str | None = None,
    section_order: list[str] | None = None,
    visible_sections: list[str] | None = None,
) -> bytes:
    """Generate a PDF from reviewer content_json. Returns raw PDF bytes.

    Args:
        section_order: Custom order of sections. Defaults to standard order.
        visible_sections: Which sections to include. Defaults to all.
    """

    buffer = io.BytesIO()
    styles = _build_styles()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
    )

    elements = []

    # Cover section
    elements.append(Spacer(1, 20 * mm))
    elements.append(Paragraph(project_title, styles["CoverTitle"]))
    elements.append(Paragraph(f"Field of Study: {field_of_study}", styles["CoverSubtitle"]))
    elements.append(Paragraph(f"Reviewer Version: {version}", styles["CoverSubtitle"]))
    if template_name:
        elements.append(Paragraph(f"Template: {template_name}", styles["CoverSubtitle"]))
    elements.append(Paragraph("Generated by CourseKin", styles["CoverSubtitle"]))
    elements.append(Spacer(1, 10 * mm))

    # Content sections — respect custom order and visibility
    order = section_order if section_order else DEFAULT_SECTION_ORDER
    visible = set(visible_sections) if visible_sections else set(DEFAULT_SECTION_ORDER)

    for section_id in order:
        if section_id not in visible:
            continue
        builder = SECTION_BUILDERS.get(section_id)
        if builder:
            builder(elements, content, styles)

    doc.build(elements)
    return buffer.getvalue()
