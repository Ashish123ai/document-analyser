"""Orchestrates the ingestion pipeline: load -> clean -> chunk -> embed -> store."""
import logging

from rag import vector_store
from rag.cleaner import clean_pages, word_count
from rag.embeddings import embed_texts
from rag.loader import DocumentLoadError, load_document
from rag.splitter import split_pages
from services import text_store

log = logging.getLogger("pipeline")


def process_document(path: str, file_type: str, user_id: str, document_id: str) -> dict:
    user_id, document_id = text_store.safe_id(user_id), text_store.safe_id(document_id)

    pages = load_document(path, file_type)           # 1. text extraction
    pages = clean_pages(pages)                       # 2. text cleaning
    words = word_count(pages)
    if words < 5:
        raise DocumentLoadError("The document contains almost no readable text.")

    chunks = split_pages(pages)                      # 3. chunking
    if not chunks:
        raise DocumentLoadError("The document could not be split into passages.")

    embeddings = embed_texts([c.text for c in chunks])  # 4. embeddings

    vector_store.delete_document(user_id, document_id)  # makes re-processing idempotent
    vector_store.add_chunks(user_id, document_id, chunks, embeddings)  # 5. vector database
    text_store.save_pages(user_id, document_id, pages)

    log.info("processed document=%s pages=%d chunks=%d words=%d", document_id, len(pages), len(chunks), words)
    return {"page_count": len(pages), "chunk_count": len(chunks), "word_count": words}


def delete_document(user_id: str, document_id: str) -> None:
    user_id, document_id = text_store.safe_id(user_id), text_store.safe_id(document_id)
    vector_store.delete_document(user_id, document_id)
    text_store.delete_pages(user_id, document_id)
