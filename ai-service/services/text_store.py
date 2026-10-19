"""Keeps each document's cleaned pages on disk so summaries/risk analysis can read the full text."""
import json
import os
import re

from config import settings
from rag.loader import Page

_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class DocumentNotFound(Exception):
    pass


def safe_id(value: str) -> str:
    """IDs become file names, so only allow a strict character set (blocks path traversal)."""
    if not _SAFE_ID.match(value or ""):
        raise ValueError("Invalid identifier")
    return value


def _path(user_id: str, document_id: str) -> str:
    return os.path.join(settings.text_dir, safe_id(user_id), f"{safe_id(document_id)}.json")


def save_pages(user_id: str, document_id: str, pages: list[Page]) -> None:
    path = _path(user_id, document_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump([{"page": p.number, "text": p.text} for p in pages], fh)


def load_pages(user_id: str, document_id: str) -> list[Page]:
    path = _path(user_id, document_id)
    if not os.path.exists(path):
        raise DocumentNotFound("This document has not been processed yet")
    with open(path, encoding="utf-8") as fh:
        return [Page(item["page"], item["text"]) for item in json.load(fh)]


def delete_pages(user_id: str, document_id: str) -> None:
    path = _path(user_id, document_id)
    if os.path.exists(path):
        os.remove(path)


def join_pages(pages: list[Page], limit: int | None = None) -> str:
    """Full text with [Page n] markers so the model can cite page numbers."""
    parts = [f"[Page {p.number}]\n{p.text}" for p in pages if p.text.strip()]
    text = "\n\n".join(parts)
    return text[:limit] if limit else text
