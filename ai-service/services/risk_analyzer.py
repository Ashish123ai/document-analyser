"""Risk detection: deterministic pattern rules first, then an optional LLM review that confirms and extends them."""
import json
import re

from config import settings
from rag.loader import Page
from rag.splitter import detect_clause_ref
from services.llm_client import LLMError, get_llm
from services.text_store import join_pages

LEVELS = ("high", "medium", "low")
_ORDER = {"high": 0, "medium": 1, "low": 2}

# Each rule: category id, title, level, regex, plain-English explanation, suggestion.
RULES = [
    dict(id="unlimited_liability", title="Unlimited liability", level="high",
         pattern=r"unlimited\s+liabilit|liabilit(?:y|ies)[^.]{0,80}\bunlimited\b|no\s+(?:limit|cap)\s+on\s+(?:the\s+)?liabilit|liabilit(?:y|ies)[^.]{0,80}\bwithout\s+(?:any\s+)?(?:limit|cap)|liable\s+for\s+all\s+(?:losses|damages|costs)",
         explanation="One party can be held responsible for losses of any size, with no ceiling.",
         recommendation="Ask for a liability cap (for example, the fees paid in the last 12 months)."),
    dict(id="broad_indemnity", title="Broad indemnity", level="high",
         pattern=r"indemnif(?:y|ies)[^.]{0,140}(?:any\s+and\s+all|all\s+(?:claims|losses|damages|liabilit))|hold\s+harmless[^.]{0,100}(?:any\s+and\s+all|all\s+claims)",
         explanation="You must cover the other side's losses and legal costs for a wide range of claims.",
         recommendation="Limit the indemnity to claims caused by your own breach or negligence."),
    dict(id="unilateral_termination", title="One-sided termination right", level="high",
         pattern=r"(?:may|can|reserves?\s+the\s+right\s+to)\s+terminate[^.]{0,100}(?:at\s+any\s+time|sole\s+discretion|without\s+(?:cause|notice|reason))|terminate\s+this\s+agreement[^.]{0,40}sole\s+discretion",
         explanation="One party can end the agreement at will, possibly without notice or a reason.",
         recommendation="Request mutual termination rights and a minimum written notice period."),
    dict(id="auto_renewal", title="Automatic renewal", level="medium",
         pattern=r"automatic(?:ally)?\s+(?:renew|extend)|auto-?renew|(?:renew|extend)(?:ed|s)?\s+automatically|shall\s+(?:be\s+)?renewed?\s+(?:for|unless)",
         explanation="The agreement continues for a new term unless you cancel in time, which is easy to miss.",
         recommendation="Note the cancellation deadline in your calendar, or negotiate an opt-in renewal."),
    dict(id="unilateral_change", title="Terms can be changed unilaterally", level="medium",
         pattern=r"(?:modify|amend|change|revise|update)[^.]{0,70}(?:at\s+any\s+time|sole\s+discretion|without\s+(?:prior\s+)?(?:notice|consent))",
         explanation="The other party can change the terms without your agreement.",
         recommendation="Require written notice and your consent for any change."),
    dict(id="non_compete", title="Non-compete / restrictive covenant", level="medium",
         pattern=r"non-?compet(?:e|ition)|shall\s+not\s+(?:engage|be\s+engaged|work)[^.]{0,100}(?:competing|competitor)|restrictive\s+covenant",
         explanation="Limits who you can work for or what business you can do, during or after the agreement.",
         recommendation="Check the duration, geography and scope are reasonable and enforceable where you live."),
    dict(id="penalties", title="Penalties or liquidated damages", level="medium",
         pattern=r"liquidated\s+damages|\bpenalt(?:y|ies)\b|forfeit(?:ure)?|late\s+(?:fee|charge|payment\s+interest)|interest\s+(?:at|of)\s+\d+(?:\.\d+)?\s*%",
         explanation="Fixed charges or loss of money apply if an obligation is missed.",
         recommendation="Confirm the amounts are proportionate and that you get a grace period."),
    dict(id="dispute_waiver", title="Arbitration or waiver of court rights", level="medium",
         pattern=r"binding\s+arbitration|waive[sd]?[^.]{0,50}(?:right\s+to\s+(?:a\s+)?(?:jury|trial|sue)|class\s+action)|exclusive\s+jurisdiction",
         explanation="Disputes may have to go to private arbitration or a specific court, limiting your options.",
         recommendation="Check where disputes are heard, who pays, and whether the venue is practical for you."),
    dict(id="ip_assignment", title="Broad intellectual property transfer", level="medium",
         pattern=r"(?:assign|transfer)s?[^.]{0,70}(?:all\s+)?(?:rights?,?\s+title|intellectual\s+property)|work\s+made\s+for\s+hire|irrevocabl[ey][^.]{0,50}(?:assign|licen[cs]e)",
         explanation="Ownership of what you create may pass to the other party, possibly permanently.",
         recommendation="Limit the transfer to work created for this agreement and keep your pre-existing IP."),
    dict(id="free_assignment", title="Agreement can be transferred without consent", level="medium",
         pattern=r"may\s+(?:freely\s+)?(?:assign|transfer)[^.]{0,80}without[^.]{0,40}consent",
         explanation="The other party can hand the agreement to someone else without asking you.",
         recommendation="Require your written consent for any assignment."),
    dict(id="perpetual_confidentiality", title="Confidentiality with no end date", level="low",
         pattern=r"confidential[^.]{0,160}(?:in\s+perpetuity|perpetual(?:ly)?|indefinite(?:ly)?)",
         explanation="Secrecy obligations never expire.",
         recommendation="Ask for a fixed period, such as 2 to 5 years after the agreement ends."),
    dict(id="non_refundable", title="Non-refundable payments", level="low",
         pattern=r"non-?refundable",
         explanation="Money paid cannot be recovered even if the deal falls through.",
         recommendation="Confirm what is non-refundable and under what circumstances."),
    dict(id="as_is_disclaimer", title="Warranty disclaimer ('as is')", level="low",
         pattern=r"\bas[\s-]is\b|disclaims?\s+(?:all\s+)?(?:implied\s+)?warrant",
         explanation="The other party gives little or no promise about quality or fitness.",
         recommendation="Check what remedies you have if the product or service is defective."),
    dict(id="standard_confidentiality", title="Standard confidentiality clause", level="low",
         pattern=r"confidential(?:ity)?\s+(?:information|obligations?)|non-?disclosure",
         explanation="Both sides must keep shared information private. This is common.",
         recommendation="Check the definition of confidential information and the exceptions."),
]
_COMPILED = [(r, re.compile(r["pattern"], re.IGNORECASE | re.DOTALL)) for r in RULES]
CATEGORY_IDS = [r["id"] for r in RULES]


def _normalize_quote(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().casefold()

LLM_SYSTEM = """You are a contracts lawyer's assistant reviewing a document for risky or unusual clauses.
Review from the perspective of an individual or small business that is asked to sign it.

You are given the document text (with [Page n] markers) and clause candidates found by a pattern scanner.
Confirm real risks, drop false positives, and add important risks the scanner missed.

Return ONLY JSON: {"risks": [ {
  "title": "short name",
  "level": "high" | "medium" | "low",
  "category": one of %s or "other",
  "page": integer page number,
  "clause_text": "exact quote from the document, max 350 characters",
  "explanation": "one or two plain-English sentences on why this is a risk",
  "recommendation": "one concrete suggestion"
} ]}
Rules: quote clause_text verbatim; use only what the text says; at most 12 risks; most severe first.
High = could cause large or open-ended loss, or removes core rights. Medium = unfavourable or easy to overlook. Low = common but worth knowing.""" % json.dumps(CATEGORY_IDS)


def overall_risk(risks: list[dict]) -> str:
    high = sum(1 for r in risks if r["level"] == "high")
    medium = sum(1 for r in risks if r["level"] == "medium")
    low = sum(1 for r in risks if r["level"] == "low")
    score = high * 3 + medium * 2 + low
    if high >= 2 or score >= 9:
        return "high"
    if high >= 1 or medium >= 2 or score >= 4:
        return "medium"
    return "low"


def _excerpt(paragraph: str, match: re.Match, width: int = 380) -> str:
    if len(paragraph) <= width:
        return paragraph.strip()
    start = max(0, match.start() - width // 3)
    end = min(len(paragraph), start + width)
    text = paragraph[start:end].strip()
    return ("…" if start > 0 else "") + text + ("…" if end < len(paragraph) else "")


def scan_rules(pages: list[Page]) -> list[dict]:
    """Returns at most two hits per rule, each with the page and a short excerpt."""
    found: list[dict] = []
    counts: dict[str, int] = {}
    for page in pages:
        for para in page.text.split("\n\n"):
            for rule, rx in _COMPILED:
                if counts.get(rule["id"], 0) >= 2:
                    continue
                m = rx.search(para)
                if not m:
                    continue
                counts[rule["id"]] = counts.get(rule["id"], 0) + 1
                found.append({
                    "title": rule["title"],
                    "level": rule["level"],
                    "category": rule["id"],
                    "page": page.number,
                    "clause_ref": detect_clause_ref(para),
                    "clause_text": _excerpt(para, m),
                    "explanation": rule["explanation"],
                    "recommendation": rule["recommendation"],
                    "evidence_strength": "strong",
                })
    return found


def _clean_llm_risk(item: dict, pages: list[Page]) -> dict | None:
    if not isinstance(item, dict) or not item.get("title"):
        return None
    level = str(item.get("level", "medium")).lower()
    valid_pages = {p.number for p in pages}
    quote = str(item.get("clause_text") or "")[:500]
    normalized_quote = _normalize_quote(quote)
    evidence_page = next(
        (p for p in pages if normalized_quote and normalized_quote in _normalize_quote(p.text)),
        None,
    )
    # Discard model findings whose quoted evidence cannot be located verbatim.
    if evidence_page is None:
        return None
    category = str(item.get("category") or "other")
    rule_match = next((rule for rule, rx in _COMPILED if rule["id"] == category and rx.search(quote)), None)
    return {
        "title": str(item["title"])[:120],
        "level": level if level in LEVELS else "medium",
        "category": category,
        "page": evidence_page.number if evidence_page.number in valid_pages else None,
        "clause_ref": detect_clause_ref(quote),
        "clause_text": quote,
        "explanation": str(item.get("explanation") or "")[:500],
        "recommendation": str(item.get("recommendation") or "")[:400],
        "evidence_strength": "strong" if rule_match else "verified_quote",
    }


def analyze(pages: list[Page]) -> dict:
    rule_hits = scan_rules(pages)
    risks = rule_hits
    llm = get_llm()

    if not llm.is_mock:
        candidates = [{"category": r["category"], "page": r["page"], "text": r["clause_text"][:250]} for r in rule_hits]
        user = f"Scanner candidates:\n{json.dumps(candidates, indent=1)}\n\nDocument text:\n\n{join_pages(pages, settings.max_analysis_chars)}"
        try:
            data = llm.complete_json(LLM_SYSTEM, user, max_tokens=3500)
            items = data.get("risks", []) if isinstance(data, dict) else data
            reviewed = [r for r in (_clean_llm_risk(i, pages) for i in items) if r]
            covered = {r["category"] for r in reviewed if r["category"] != "other"}
            # Keep scanner hits for categories the model did not mention (it may have trimmed the list).
            risks = reviewed + [r for r in rule_hits if r["category"] not in covered and r["level"] != "low"]
        except LLMError:
            risks = rule_hits

    risks.sort(key=lambda r: (_ORDER[r["level"]], r["page"] or 0))
    return {"risk_level": overall_risk(risks), "risks": risks}
