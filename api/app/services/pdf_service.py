from pathlib import Path

from pypdf import PdfReader


def extract_pdf_pages(file_path: str) -> list[tuple[int, str]]:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found: {file_path}")

    reader = PdfReader(str(path))
    pages: list[tuple[int, str]] = []

    for page_number, page in enumerate(reader.pages, 1):
        text = page.extract_text() or ""
        text = text.strip()
        if text:
            pages.append((page_number, text))

    return pages


def extract_pdf_text(file_path: str) -> str:
    return "\n\n".join(text for _, text in extract_pdf_pages(file_path)).strip()
