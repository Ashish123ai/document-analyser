"""Structured document summary (executive summary, parties, payment terms, ...)."""
import re
from concurrent.futures import ThreadPoolExecutor

from config import settings
from rag.loader import Page
from services.llm_client import LLMError, get_llm
from services.text_store import join_pages

LIST_FIELDS = ["parties", "payment_terms", "termination_conditions", "responsibilities", "penalties", "important_dates"]
TEXT_FIELDS = ["executive_summary", "contract_type", "duration"]

SYSTEM = """You analyse legal documents. Extract a structured summary using ONLY the text provided.
Return ONLY a JSON object with exactly these keys:
{
  "executive_summary": "3-5 plain-English sentences on what the document is and what it does",
  "contract_type": "e.g. Residential lease, Employment agreement, NDA",
  "parties": ["Name (role)"],
  "duration": "term of the agreement, or 'Not specified'",
  "payment_terms": ["each payment obligation with amounts and due dates"],
  "termination_conditions": ["how and when each party can end the agreement, including notice periods"],
  "responsibilities": ["key obligations of each party"],
  "penalties": ["fees, damages, forfeitures or other consequences of breach"],
  "important_dates": ["date - what happens"]
}
If something is not in the text use an empty list or "Not specified". Never invent facts. Keep each list item under 200 characters."""

CHAT_SUMMARY_SYSTEM = """Summarize the uploaded document in plain English for the user's request.
Use only the document text. Cover its purpose and the most important details. Keep it concise,
and do not force legal-contract categories onto a document that is not a contract."""

NOTES_SYSTEM = """You are reading one section of a long legal document. Write short factual notes (bullet points) on:
parties, contract type, duration, payments, termination, key obligations, penalties and dates.
Include page numbers from the [Page n] markers. Use ONLY the text provided. Do not add commentary."""


def summarize(pages: list[Page]) -> dict:
    llm = get_llm()
    if llm.is_mock:
        return heuristic_summary(pages)

    text = join_pages(pages)
    try:
        if len(text) > settings.max_direct_chars:
            text = _map_reduce_notes(text)
        data = llm.complete_json(SYSTEM, f"Document text:\n\n{text}", max_tokens=2000)
        return _normalise(data)
    except LLMError:
        # A model hiccup should not break the whole analysis: fall back to rule-based extraction.
        return heuristic_summary(pages)


def summarize_for_chat(pages: list[Page]) -> str:
    """Create a general-purpose overview for summary requests made in document chat."""
    text = join_pages(pages)
    if not text.strip():
        return ""

    llm = get_llm()
    if llm.is_mock:
        # The offline provider cannot write a new abstractive summary; return an
        # extractive overview so summary questions still use the whole document.
        return _as_bullets(heuristic_summary(pages)["executive_summary"])

    try:
        response = llm.complete(CHAT_SUMMARY_SYSTEM, f"Document text:\n\n{text}", max_tokens=700).strip()
        return _as_bullets(response)
    except LLMError:
        return _as_bullets(heuristic_summary(pages)["executive_summary"])


def _as_bullets(text: str) -> str:
    """Normalize summary output into readable one-point-per-line bullets."""
    points = []
    for line in text.splitlines():
        line = re.sub(r"^\s*(?:[-*•]+|\d+[.)])\s*", "", line).strip()
        if not line:
            continue
        # Split plain paragraph summaries into separate sentences too.
        points.extend(part.strip() for part in re.split(r"(?<=[.!?])\s+", line) if part.strip())
    return "\n".join(f"• {point}" for point in points)


def _map_reduce_notes(text: str, window: int = 14000, max_windows: int = 12) -> str:
    llm = get_llm()
    windows = [text[i : i + window] for i in range(0, len(text), window)][:max_windows]

    def notes(w: str) -> str:
        return llm.complete(NOTES_SYSTEM, w, max_tokens=700)

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(notes, windows))
    return "Notes from each section of the document:\n\n" + "\n\n".join(results)


def _normalise(data: dict) -> dict:
    out = {}
    for key in TEXT_FIELDS:
        value = data.get(key)
        out[key] = str(value).strip() if value else "Not specified"
    for key in LIST_FIELDS:
        value = data.get(key) or []
        if isinstance(value, str):
            value = [value]
        out[key] = [str(v).strip() for v in value if str(v).strip()][:12]
    return out


# ------------------------------------------------------------------ rule-based fallback
_DATE = re.compile(
    r"\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4}"
    r"|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}"
    r"|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b",
    re.IGNORECASE,
)
_TYPES = [
    ("Lease / rental agreement", r"\b(lease|rental agreement|tenant|landlord|lessor|lessee)\b"),
    ("Employment agreement", r"\b(employment|employee|employer|salary)\b"),
    ("Non-disclosure agreement", r"\b(non-?disclosure|confidentiality agreement|nda)\b"),
    ("Service agreement", r"\b(services? agreement|service provider|statement of work|consultant)\b"),
    ("Sale agreement", r"\b(sale agreement|purchase agreement|seller|buyer)\b"),
    ("Loan agreement", r"\b(loan|borrower|lender|principal amount)\b"),
    ("Partnership agreement", r"\b(partnership|partners)\b"),
]


def _sentences(text: str) -> list[str]:
    flat = re.sub(r"\s+", " ", text)
    return [s.strip() for s in re.split(r"(?<=[.;!?])\s+(?=[A-Z0-9(])", flat) if len(s.strip()) > 25]


def _pick(sentences: list[str], pattern: str, limit: int) -> list[str]:
    rx = re.compile(pattern, re.IGNORECASE)
    return [s[:220] for s in sentences if rx.search(s)][:limit]


def heuristic_summary(pages: list[Page]) -> dict:
    full = "\n".join(p.text for p in pages)
    head = full[:2500]
    sentences = _sentences(full)

    contract_type = "Not identified"
    best = 0
    for label, pattern in _TYPES:
        hits = len(re.findall(pattern, full[:8000], re.IGNORECASE))
        if hits > best:
            contract_type, best = label, hits

    parties = []
    m = re.search(r"between\s+(.{3,120}?)\s+(?:and|&)\s+(.{3,120}?)(?:[,.(]|\s+\(|\s+hereinafter|\s+dated)", head, re.IGNORECASE | re.DOTALL)
    if m:
        parties = [re.sub(r"\s+", " ", m.group(1)).strip(), re.sub(r"\s+", " ", m.group(2)).strip()]

    dur = re.search(r"\b(term|period|duration)\b[^.]{0,80}?\b(\d+|one|two|three|five|six|twelve)\s*(?:\(\d+\)\s*)?(year|month|week|day)s?\b", full, re.IGNORECASE)
    duration = re.sub(r"\s+", " ", dur.group(0)).strip() if dur else "Not specified"

    dates = list(dict.fromkeys(m.group(0) for m in _DATE.finditer(full)))[:8]

    return {
        "executive_summary": " ".join(_sentences(head)[:3])[:700] or full[:500],
        "contract_type": contract_type,
        "parties": parties,
        "duration": duration,
        "payment_terms": _pick(sentences, r"\b(pay|payable|rent|fee|salary|invoice|deposit)\b.*(\d|\$|₹|€|£)", 4),
        "termination_conditions": _pick(sentences, r"\bterminat", 4),
        "responsibilities": _pick(sentences, r"\b(shall|must|agrees to|responsible for|obligated)\b", 5),
        "penalties": _pick(sentences, r"\b(penalt|liquidated damages|late fee|forfeit|interest at|breach)\b", 4),
        "important_dates": dates,
    }
