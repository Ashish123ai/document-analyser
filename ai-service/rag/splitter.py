"""Step 3: chunking. Splits each page into overlapping chunks and tags them with a clause reference."""
import re
from dataclasses import dataclass

from langchain_text_splitters import RecursiveCharacterTextSplitter

from config import settings
from rag.loader import Page

MIN_CHUNK_CHARS = 30

_KEYWORD_REF = re.compile(r"\b(clause|section|article|paragraph)\s+(\d+(?:\.\d+)*(?:\([a-z0-9]+\))?)", re.IGNORECASE)
_NUMBERED_START = re.compile(r"(?:^|\n)\s*(\d+(?:\.\d+)+|\d+[.)])\s+[A-Z]")


@dataclass
class Chunk:
    text: str
    page: int
    chunk_index: int
    clause: str | None = None


def detect_clause_ref(text: str) -> str | None:
    """Finds a clause label such as 'Clause 8.2' near the start of a passage."""
    head = text[:250]
    m = _KEYWORD_REF.search(head)
    if m:
        return f"{m.group(1).capitalize()} {m.group(2)}"
    m = _NUMBERED_START.search(head)
    if m:
        return f"Clause {m.group(1).rstrip('.)')}"
    return None


def split_pages(pages: list[Page], chunk_size: int | None = None, overlap: int | None = None) -> list[Chunk]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size or settings.chunk_size,
        chunk_overlap=overlap if overlap is not None else settings.chunk_overlap,
        separators=["\n\n", "\n", ". ", "; ", ", ", " ", ""],
    )
    chunks: list[Chunk] = []
    for page in pages:
        if not page.text.strip():
            continue
        for piece in splitter.split_text(page.text):
            piece = piece.strip()
            if len(piece) < MIN_CHUNK_CHARS:
                continue
            chunks.append(Chunk(piece, page.number, len(chunks), detect_clause_ref(piece)))
    return chunks
