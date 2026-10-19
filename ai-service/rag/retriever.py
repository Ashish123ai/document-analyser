"""Step 6: retrieval. Dense vector search re-ranked with a small keyword-overlap signal (hybrid)."""
import re
from dataclasses import dataclass
from urllib.parse import urlparse

from config import settings
from rag import vector_store
from rag.embeddings import embed_query
from services.llm_client import LLMError, get_llm

_STOPWORDS = {
    "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "had", "her", "was", "one", "our",
    "out", "has", "have", "what", "when", "where", "which", "who", "whom", "this", "that", "with", "from",
    "does", "did", "how", "why", "will", "shall", "would", "could", "should", "about", "into", "than", "then",
    "there", "their", "they", "them", "its", "your", "his", "she", "him", "been", "being", "were", "also",
    "tell", "please", "say", "says", "mentioned", "document", "agreement", "contract",
}

DENSE_WEIGHT = 0.9
LEXICAL_WEIGHT = 0.1

QUERY_EXPANSION_SYSTEM = """Rewrite the user's document question as up to three short alternative search queries.
Use likely synonyms and equivalent ways the document may express the same fact. Keep the intent
unchanged, do not answer the question, and return one query per line with no extra commentary."""


@dataclass
class RetrievedChunk:
    text: str
    page: int
    clause: str | None
    score: float
    chunk_index: int


def _keywords(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) > 2 and w not in _STOPWORDS}


def _query_variants(query: str) -> list[str]:
    """Optionally add paraphrases for remote models; always retain the original query."""
    variants = [query.strip()]
    llm = get_llm()
    if llm.is_mock:
        return variants
    # Local models can take several seconds for each generation. SentenceTransformer
    # already performs semantic search, so avoid a second full LLM call just to
    # rewrite a query when the configured model is running on this machine.
    if urlparse(settings.openai_base_url).hostname in {"localhost", "127.0.0.1", "::1"}:
        return variants
    try:
        expanded = llm.complete(QUERY_EXPANSION_SYSTEM, query, max_tokens=160)
    except LLMError:
        return variants

    for line in expanded.splitlines():
        candidate = re.sub(r"^\s*(?:[-*•]+|\d+[.)])\s*", "", line).strip().strip('"\' ')
        if candidate and candidate.casefold() not in {v.casefold() for v in variants}:
            variants.append(candidate[:500])
        if len(variants) == 4:
            break
    return variants


def retrieve(
    query: str,
    user_id: str,
    document_id: str,
    top_k: int | None = None,
    min_score: float | None = None,
) -> list[RetrievedChunk]:
    top_k = top_k or settings.top_k
    min_score = settings.min_relevance if min_score is None else min_score

    # Start with one embedding search. Only pay for LLM query expansion if the
    # direct semantic match is weak.
    candidates: dict[int, dict] = {}

    def add_candidates(variants: list[str]) -> None:
        for variant in variants:
            rows = vector_store.query(embed_query(variant), user_id, document_id, n_results=top_k * 3)
            for row in rows:
                chunk_index = int(row["meta"]["chunk_index"])
                dense = max(0.0, 1.0 - row["distance"])
                existing = candidates.get(chunk_index)
                if existing is None or dense > existing["dense"]:
                    candidates[chunk_index] = {**row, "dense": dense}

    def rank_candidates(variants: list[str]) -> list[RetrievedChunk]:
        query_terms = [_keywords(variant) for variant in variants]
        ranked = []
        for row in candidates.values():
            text_terms = _keywords(row["text"])
            overlap = max(
                (len(words & text_terms) / len(words) for words in query_terms if words),
                default=0.0,
            )
            score = DENSE_WEIGHT * row["dense"] + LEXICAL_WEIGHT * overlap
            meta = row["meta"]
            ranked.append(RetrievedChunk(
                row["text"], int(meta["page"]), meta.get("clause") or None,
                round(score, 4), int(meta["chunk_index"]),
            ))
        return sorted(ranked, key=lambda chunk: chunk.score, reverse=True)

    add_candidates([query])
    scored = rank_candidates([query])
    if not scored or scored[0].score < max(min_score + 0.08, 0.30):
        expanded = _query_variants(query)[1:]
        if expanded:
            add_candidates(expanded)
            scored = rank_candidates([query, *expanded])

    return [c for c in scored[:top_k] if c.score >= min_score]
