"""Step 2: text cleaning. Removes noise that hurts embeddings and retrieval."""
import re
import unicodedata
from collections import Counter

from rag.loader import Page

_PAGE_NUMBER = re.compile(r"^(page\s*)?\d{1,4}(\s*(of|/)\s*\d{1,4})?$", re.IGNORECASE)
_ZERO_WIDTH = dict.fromkeys(map(ord, "\u200b\u200c\u200d\ufeff\x00\x0b\x0c"), None)


def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).translate(_ZERO_WIDTH)
    text = text.replace("\u00a0", " ")
    paragraphs = []
    for para in re.split(r"\n\s*\n", text):
        para = re.sub(r"[ \t]+", " ", para)
        para = re.sub(r"\s*\n\s*", " ", para).strip()
        if para:
            paragraphs.append(para)
    return "\n\n".join(paragraphs)


def _fingerprint(paragraph: str) -> str:
    # Page numbers inside a header/footer differ per page, so mask digits before comparing.
    return re.sub(r"\d+", "#", paragraph.lower()).strip()


def _edge_indexes(n: int) -> set[int]:
    """Positions that can hold a running header/footer. Short pages are left alone so body text is never stripped."""
    if n <= 2:
        return set()
    k = 2 if n >= 6 else 1
    return set(range(k)) | set(range(n - k, n))


def remove_headers_footers(pages: list[Page]) -> list[Page]:
    """Drops short paragraphs that repeat at the top/bottom of most pages (running headers, footers)."""
    if len(pages) < 3:
        return pages

    split = [p.text.split("\n\n") for p in pages]
    counts: Counter = Counter()
    for paras in split:
        edges = _edge_indexes(len(paras))
        counts.update({_fingerprint(paras[i]) for i in edges if len(paras[i]) < 120})

    threshold = max(2, int(len(pages) * 0.6))
    repeated = {fp for fp, n in counts.items() if n >= threshold}

    cleaned = []
    for page, paras in zip(pages, split):
        edges = _edge_indexes(len(paras))
        keep = [x for i, x in enumerate(paras) if not (i in edges and len(x) < 120 and _fingerprint(x) in repeated)]
        cleaned.append(Page(page.number, "\n\n".join(keep)))
    return cleaned


def clean_pages(pages: list[Page]) -> list[Page]:
    normalized = [Page(p.number, normalize_text(p.text)) for p in pages]
    normalized = remove_headers_footers(normalized)

    result = []
    for page in normalized:
        paras = [x for x in page.text.split("\n\n") if x and not _PAGE_NUMBER.match(x)]
        result.append(Page(page.number, "\n\n".join(paras)))
    return result


def word_count(pages: list[Page]) -> int:
    return sum(len(p.text.split()) for p in pages)
