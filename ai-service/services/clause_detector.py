"""Clause detection: finds the most representative paragraph for each standard clause type."""
import re

from rag.loader import Page
from rag.splitter import detect_clause_ref
from services.llm_client import LLMError, get_llm

# type -> (label, keyword patterns, expected in most contracts)
CLAUSE_TYPES = {
    "termination": ("Termination", [r"\bterminat\w*", r"notice\s+period", r"\bcancel\w*", r"expir\w+"], True),
    "payment": ("Payment", [r"\bpayment\w*", r"\bfees?\b", r"\brent\b", r"\binvoice\w*", r"\bcompensation\b", r"\bsalary\b", r"\bprice\b"], True),
    "confidentiality": ("Confidentiality", [r"\bconfidential\w*", r"non-?disclosure", r"\bproprietary\s+information"], True),
    "liability": ("Liability", [r"\bliabilit\w+", r"\bliable\b", r"limitation\s+of\s+liability", r"\bdamages\b"], True),
    "indemnity": ("Indemnity", [r"\bindemnif\w+", r"hold\s+harmless"], False),
    "dispute_resolution": ("Dispute resolution", [r"\bdispute\w*", r"\barbitrat\w+", r"\bmediation\b", r"\bjurisdiction\b", r"\bcourts?\b"], True),
    "governing_law": ("Governing law", [r"governing\s+law", r"governed\s+by", r"laws\s+of\s+the", r"construed\s+in\s+accordance"], True),
    "renewal": ("Renewal", [r"\brenew\w*", r"\bextension\b", r"\bextend\w*"], False),
    "non_compete": ("Non-compete", [r"non-?compet\w+", r"competing\s+business", r"restrictive\s+covenant", r"non-?solicit\w*"], False),
    "assignment": ("Assignment", [r"\bassign\w*", r"\bsublet\w*", r"\bsubcontract\w*", r"\btransfer\s+(?:of\s+)?(?:this|its|any)\s+(?:agreement|rights)"], False),
    "force_majeure": ("Force majeure", [r"force\s+majeure", r"act\s+of\s+god", r"beyond\s+(?:its|their|the)\s+reasonable\s+control"], False),
    "intellectual_property": ("Intellectual property", [r"intellectual\s+property", r"\bcopyright\b", r"\bpatent\w*", r"\btrademark\w*", r"\bwork\s+product\b"], False),
}
_COMPILED = {k: [re.compile(p, re.IGNORECASE) for p in v[1]] for k, v in CLAUSE_TYPES.items()}

MIN_SCORE = 2

EXPLAIN_SYSTEM = """For each clause excerpt, write ONE plain-English sentence (max 30 words) explaining what it means in practice.
Use only the excerpt. Return ONLY JSON: {"explanations": {"<type>": "<sentence>"}}"""


def _score(paragraph: str, patterns: list[re.Pattern]) -> int:
    hits = sum(1 for rx in patterns if rx.search(paragraph))
    heading = paragraph[:70]
    if any(rx.search(heading) for rx in patterns):
        hits += 3  # the clause is named in its heading
    if len(paragraph) < 60:
        hits -= 1  # bare headings carry no content
    return hits


def _first_sentence(text: str, limit: int = 220) -> str:
    sentence = re.split(r"(?<=[.;!?])\s+", re.sub(r"\s+", " ", text).strip(), maxsplit=1)[0]
    return sentence[:limit]


def detect(pages: list[Page]) -> dict:
    best: dict[str, tuple[int, int, str]] = {}  # type -> (score, page, paragraph)
    for page in pages:
        for para in page.text.split("\n\n"):
            if len(para) < 25:
                continue
            for ctype, patterns in _COMPILED.items():
                score = _score(para, patterns)
                if score >= MIN_SCORE and (ctype not in best or score > best[ctype][0]):
                    best[ctype] = (score, page.number, para)

    clauses = []
    for ctype, (_, page_no, para) in best.items():
        label = CLAUSE_TYPES[ctype][0]
        clauses.append({
            "type": ctype,
            "label": label,
            "page": page_no,
            "clause_ref": detect_clause_ref(para),
            "excerpt": para[:600],
            "explanation": _first_sentence(para),
        })

    _explain_with_llm(clauses)
    clauses.sort(key=lambda c: (c["page"], c["label"]))

    missing = [CLAUSE_TYPES[t][0] for t, v in CLAUSE_TYPES.items() if v[2] and t not in best]
    return {"clauses": clauses, "missing": missing}


def _explain_with_llm(clauses: list[dict]) -> None:
    llm = get_llm()
    if llm.is_mock or not clauses:
        return
    payload = "\n\n".join(f"<{c['type']}>\n{c['excerpt'][:500]}" for c in clauses)
    try:
        data = llm.complete_json(EXPLAIN_SYSTEM, payload, max_tokens=1500)
        explanations = data.get("explanations", {}) if isinstance(data, dict) else {}
        for c in clauses:
            text = explanations.get(c["type"])
            if isinstance(text, str) and text.strip():
                c["explanation"] = text.strip()[:300]
    except LLMError:
        pass  # keep the first-sentence fallback
