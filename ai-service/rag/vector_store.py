"""Step 5: vector database (ChromaDB, persisted on disk).

Every chunk is stored with user_id and document_id metadata, and EVERY query filters on both,
so one user's question can never retrieve another user's document.
"""
import re
import threading

import chromadb
from chromadb.config import Settings as ChromaSettings

from config import settings
from rag.embeddings import model_name
from rag.splitter import Chunk

_lock = threading.Lock()
_collection = None
BATCH = 500


def _collection_name() -> str:
    # Vectors from different embedding models are incompatible, so each model gets its own collection.
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", model_name()).strip("_")[:40]
    return f"legal_chunks_{slug}"


def get_collection():
    global _collection
    if _collection is None:
        with _lock:
            if _collection is None:
                client = chromadb.PersistentClient(
                    path=settings.chroma_dir,
                    settings=ChromaSettings(anonymized_telemetry=False),
                )
                _collection = client.get_or_create_collection(
                    name=_collection_name(), metadata={"hnsw:space": "cosine"}
                )
    return _collection


def _where(user_id: str, document_id: str) -> dict:
    return {"$and": [{"user_id": user_id}, {"document_id": document_id}]}


def add_chunks(user_id: str, document_id: str, chunks: list[Chunk], embeddings: list[list[float]]) -> None:
    col = get_collection()
    for start in range(0, len(chunks), BATCH):
        part = chunks[start : start + BATCH]
        col.add(
            ids=[f"{document_id}_{c.chunk_index}" for c in part],
            embeddings=embeddings[start : start + BATCH],
            documents=[c.text for c in part],
            metadatas=[
                {
                    "user_id": user_id,
                    "document_id": document_id,
                    "page": c.page,
                    "chunk_index": c.chunk_index,
                    "clause": c.clause or "",
                }
                for c in part
            ],
        )


def query(embedding: list[float], user_id: str, document_id: str, n_results: int) -> list[dict]:
    col = get_collection()
    res = col.query(
        query_embeddings=[embedding],
        n_results=n_results,
        where=_where(user_id, document_id),
        include=["documents", "metadatas", "distances"],
    )
    rows = []
    for text, meta, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
        rows.append({"text": text, "meta": meta, "distance": dist})
    return rows


def count(user_id: str, document_id: str) -> int:
    got = get_collection().get(where=_where(user_id, document_id), include=[])
    return len(got["ids"])


def delete_document(user_id: str, document_id: str) -> None:
    get_collection().delete(where=_where(user_id, document_id))
