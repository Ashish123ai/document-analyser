from rag.loader import Page
from services import clause_detector, risk_analyzer, summarizer
from tests.sample_contract import CONTRACT


def pages():
    return [Page(1, "\n\n".join(p.strip() for p in CONTRACT.split("\n\n") if p.strip()))]


def test_risk_rules_flag_the_obvious_problems():
    result = risk_analyzer.analyze(pages())
    categories = {r["category"] for r in result["risks"]}
    assert {"unlimited_liability", "broad_indemnity", "unilateral_termination", "auto_renewal", "penalties"} <= categories
    assert result["risk_level"] == "high"
    levels = [r["level"] for r in result["risks"]]
    assert levels == sorted(levels, key=lambda l: {"high": 0, "medium": 1, "low": 2}[l])  # most severe first


def test_overall_risk_levels():
    mk = lambda *lv: [{"level": l} for l in lv]
    assert risk_analyzer.overall_risk(mk()) == "low"
    assert risk_analyzer.overall_risk(mk("low")) == "low"
    assert risk_analyzer.overall_risk(mk("high")) == "medium"
    assert risk_analyzer.overall_risk(mk("high", "high")) == "high"


def test_clean_contract_is_not_high_risk():
    text = "The Supplier shall deliver the goods within ten days. The Buyer shall pay the invoice within thirty days of delivery."
    assert risk_analyzer.analyze([Page(1, text)])["risk_level"] == "low"


def test_clause_detection_finds_types_and_missing():
    result = clause_detector.detect(pages())
    types = {c["type"] for c in result["clauses"]}
    assert {"termination", "payment", "governing_law", "confidentiality", "liability"} <= types
    termination = next(c for c in result["clauses"] if c["type"] == "termination")
    assert termination["clause_ref"] == "Clause 3"
    assert "Confidentiality" not in result["missing"]

    sparse = clause_detector.detect([Page(1, "The parties meet on Tuesday to discuss the weather and lunch plans.")])
    assert "Governing law" in sparse["missing"] and "Termination" in sparse["missing"]


def test_heuristic_summary_extracts_basics():
    s = summarizer.heuristic_summary(pages())
    assert "Lease" in s["contract_type"]
    assert any("Ravi Sharma" in p for p in s["parties"])
    assert "twelve" in s["duration"].lower()
    assert any("1 January 2026" in d for d in s["important_dates"])
    assert s["termination_conditions"]


def test_summary_enrichment_adds_type_entities_and_obligations():
    source = [Page(1, "The Landlord shall return the Rs. 25,000 deposit within 30 days. The Tenant must pay rent by 1 February 2026.")]
    summary = summarizer.enrich_summary({"parties": ["Landlord", "Tenant"], "contract_type": "Lease"}, source)
    assert summary["document_type"] == "Lease / rental agreement"
    assert "Deposit" in summary["checklist"]
    assert "Rs. 25,000" in summary["entities"]["amounts"]
    assert len(summary["obligations"]) == 2
    assert summary["obligations"][0]["deadline"].lower() == "within 30 days"
