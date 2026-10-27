"""Run the small, hand-labelled clause and retrieval benchmark."""
import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("LLM_PROVIDER", "mock")
_tmp = tempfile.TemporaryDirectory(prefix="legal-analyzer-evaluation-")
os.environ["CHROMA_DIR"] = os.path.join(_tmp.name, "chroma")
os.environ["TEXT_DIR"] = os.path.join(_tmp.name, "texts")

from rag import vector_store
from rag.retriever import retrieve
from services import document_service
from services import text_store
from services.clause_detector import MIN_SCORE, _COMPILED, _score

DATASET = Path(__file__).with_name("benchmark.json")


def predicted_clause_types(text: str) -> set[str]:
    predicted = set()
    for paragraph in text.split("\n\n"):
        if len(paragraph) < 25:
            continue
        for clause_type, patterns in _COMPILED.items():
            if _score(paragraph, patterns) >= MIN_SCORE:
                predicted.add(clause_type)
    return predicted


def clause_metrics(samples: list[dict]) -> dict:
    true_positive = false_positive = false_negative = 0
    for sample in samples:
        expected = set(sample["expected_clauses"])
        predicted = predicted_clause_types(sample["text"])
        true_positive += len(expected & predicted)
        false_positive += len(predicted - expected)
        false_negative += len(expected - predicted)
    precision = true_positive / (true_positive + false_positive) if true_positive + false_positive else 0
    recall = true_positive / (true_positive + false_negative) if true_positive + false_negative else 0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0
    return {
        "true_positive": true_positive,
        "false_positive": false_positive,
        "false_negative": false_negative,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
    }


def retrieval_hit_rate(samples: list[dict]) -> dict:
    hits = total = 0
    user_id = "evaluation-user"
    for sample in samples:
        document_id = sample["id"]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", encoding="utf-8", delete=False) as source:
            source.write(sample["text"])
            source_path = source.name
        try:
            document_service.process_document(source_path, "txt", user_id, document_id)
            for item in sample["retrieval"]:
                chunks = retrieve(item["query"], user_id, document_id, top_k=3, min_score=0.0)
                hits += int(any(item["expected_text"].casefold() in chunk.text.casefold() for chunk in chunks))
                total += 1
        finally:
            os.unlink(source_path)
            vector_store.delete_document(user_id, document_id)
            text_store.delete_pages(user_id, document_id)
    return {"hits": hits, "queries": total, "hit_rate_at_3": round(hits / total, 4) if total else 0}


def main() -> None:
    samples = json.loads(DATASET.read_text(encoding="utf-8"))
    try:
        output = {
            "dataset": DATASET.name,
            "sample_count": len(samples),
            "clause_detection_micro": clause_metrics(samples),
            "retrieval": retrieval_hit_rate(samples),
            "note": "Small synthetic benchmark for regression checks; not a representative legal-domain evaluation.",
        }
        print(json.dumps(output, indent=2))
    finally:
        vector_store.close()
        _tmp.cleanup()


if __name__ == "__main__":
    main()
