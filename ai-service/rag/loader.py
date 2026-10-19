"""Step 1: text extraction from PDF, DOCX and TXT into a list of pages."""
from dataclasses import dataclass

from config import settings


class DocumentLoadError(Exception):
    """Raised when a file cannot be read or contains no extractable text."""


@dataclass
class Page:
    number: int  # 1-based
    text: str    # paragraphs separated by a blank line


def load_document(path: str, file_type: str) -> list[Page]:
    loaders = {"pdf": _load_pdf, "docx": _load_docx, "txt": _load_txt}
    loader = loaders.get(file_type.lower())
    if loader is None:
        raise DocumentLoadError(f"Unsupported file type: {file_type}")
    try:
        pages = loader(path)
    except DocumentLoadError:
        raise
    except Exception as exc:  # corrupt, encrypted, etc.
        raise DocumentLoadError(f"Could not read the {file_type.upper()} file: {exc}") from exc

    if not any(p.text.strip() for p in pages):
        raise DocumentLoadError(
            "No text could be extracted. If this is a scanned PDF, run OCR on it first and upload the result."
        )
    return pages


def _load_pdf(path: str) -> list[Page]:
    import fitz  # PyMuPDF

    pages: list[Page] = []
    with fitz.open(path) as doc:
        if doc.needs_pass:
            raise DocumentLoadError("This PDF is password protected.")
        for index, page in enumerate(doc, start=1):
            # "blocks" gives paragraph-sized text blocks in reading order.
            blocks = page.get_text("blocks", sort=True)
            paragraphs = []
            for block in blocks:
                if block[6] != 0:  # 0 = text block, 1 = image block
                    continue
                text = block[4].replace("-\n", "").replace("\n", " ").strip()
                if text:
                    paragraphs.append(text)
            pages.append(Page(index, "\n\n".join(paragraphs)))
    return pages


def _load_docx(path: str) -> list[Page]:
    from docx import Document
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    doc = Document(path)
    paragraphs: list[str] = []
    # Walk the body in order so tables stay next to the text around them.
    for child in doc.element.body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            text = Paragraph(child, doc).text.strip()
            if text:
                paragraphs.append(text)
        elif tag == "tbl":
            for row in Table(child, doc).rows:
                cells = []
                for cell in row.cells:
                    value = cell.text.strip()
                    if value and (not cells or cells[-1] != value):  # merged cells repeat their text
                        cells.append(value)
                if cells:
                    paragraphs.append(" | ".join(cells))
    return _group_into_virtual_pages(paragraphs)


def _load_txt(path: str) -> list[Page]:
    with open(path, "rb") as fh:
        raw = fh.read()
    for encoding in ("utf-8-sig", "utf-16", "cp1252", "latin-1"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeError:
            continue
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if len(paragraphs) <= 1:  # no blank lines: treat every line as a paragraph
        paragraphs = [line.strip() for line in text.split("\n") if line.strip()]
    else:
        paragraphs = [" ".join(p.split("\n")) for p in paragraphs]
    return _group_into_virtual_pages(paragraphs)


def _group_into_virtual_pages(paragraphs: list[str]) -> list[Page]:
    pages: list[Page] = []
    current: list[str] = []
    size = 0
    for para in paragraphs:
        if current and size + len(para) > settings.virtual_page_chars:
            pages.append(Page(len(pages) + 1, "\n\n".join(current)))
            current, size = [], 0
        current.append(para)
        size += len(para)
    if current:
        pages.append(Page(len(pages) + 1, "\n\n".join(current)))
    return pages
