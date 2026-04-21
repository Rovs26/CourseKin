from pathlib import Path

from pypdf import PdfReader


def extract_pdf_text(file_path: str) -> str:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF file not found: {file_path}")

    reader = PdfReader(str(path))
    parts: list[str] = []

    for page in reader.pages:
        text = page.extract_text() or ""
        text = text.strip()
        if text:
            parts.append(text)

    extracted = "\n\n".join(parts).strip()
    return extracted