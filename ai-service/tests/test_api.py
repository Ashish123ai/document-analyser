"""End-to-end test of the FastAPI service (offline embedder + mock LLM)."""
import pytest
from fastapi.testclient import TestClient

from main import app
from tests.sample_contract import CONTRACT

H = {"X-Internal-Key": "test-key"}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def upload(client, doc_id, user_id, text=CONTRACT):
    return client.post(
        "/process-document",
        headers=H,
        files={"file": ("lease.txt", text.encode(), "text/plain")},
        data={"document_id": doc_id, "user_id": user_id, "file_type": "txt"},
    )


def test_requires_internal_key(client):
    assert client.post("/summarize", json={"document_id": "d1", "user_id": "u1"}).status_code == 401
    assert client.post("/summarize", headers={"X-Internal-Key": "wrong"}, json={"document_id": "d1", "user_id": "u1"}).status_code == 401
    assert client.get("/health").status_code == 200


def test_full_flow_and_user_isolation(client):
    res = upload(client, "doc_a", "user_a")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["chunk_count"] >= 3 and body["page_count"] >= 1 and body["word_count"] > 100

    # Q&A returns a cited, grounded answer
    ask = client.post("/ask", headers=H, json={"document_id": "doc_a", "user_id": "user_a", "question": "How much notice must the tenant give to terminate early?"})
    assert ask.status_code == 200, ask.text
    data = ask.json()
    assert data["found"] is True
    assert data["sources"] and "thirty" in " ".join(s["text"] for s in data["sources"]).lower()

    # A question unrelated to the document is refused instead of hallucinated
    off = client.post("/ask", headers=H, json={"document_id": "doc_a", "user_id": "user_a", "question": "quantum chromodynamics gluon spectroscopy"})
    assert off.json()["found"] is False
    assert off.json()["sources"] == []

    # Analysis endpoints
    assert client.post("/summarize", headers=H, json={"document_id": "doc_a", "user_id": "user_a"}).json()["contract_type"]
    risk = client.post("/analyze-risk", headers=H, json={"document_id": "doc_a", "user_id": "user_a"}).json()
    assert risk["risk_level"] == "high" and risk["risks"]
    clauses = client.post("/detect-clauses", headers=H, json={"document_id": "doc_a", "user_id": "user_a"}).json()
    assert clauses["clauses"]

    # ISOLATION: another user cannot read or query this document, even knowing its id
    other = client.post("/ask", headers=H, json={"document_id": "doc_a", "user_id": "user_b", "question": "What is the rent?"})
    assert other.status_code == 404
    assert client.post("/summarize", headers=H, json={"document_id": "doc_a", "user_id": "user_b"}).status_code == 404


def test_same_document_id_for_two_users_does_not_mix(client):
    upload(client, "shared_id", "user_c", "The Seller shall deliver 500 widgets to the Buyer by March.")
    upload(client, "shared_id", "user_d", "The Landlord shall return the deposit within thirty days.")
    r = client.post("/ask", headers=H, json={"document_id": "shared_id", "user_id": "user_c", "question": "How many widgets are delivered?"}).json()
    assert all("Landlord" not in s["text"] for s in r["sources"])


def test_delete_removes_everything(client):
    upload(client, "doc_del", "user_e")
    assert client.delete("/documents/doc_del", headers=H, params={"user_id": "user_e"}).status_code == 200
    r = client.post("/ask", headers=H, json={"document_id": "doc_del", "user_id": "user_e", "question": "What is the rent?"})
    assert r.status_code == 404


def test_rejects_bad_input(client):
    assert upload(client, "../etc/passwd", "user_a").status_code in (400, 422)
    bad = client.post("/process-document", headers=H, files={"file": ("x.exe", b"MZ", "application/octet-stream")}, data={"document_id": "d9", "user_id": "u9", "file_type": "exe"})
    assert bad.status_code == 400
    empty = upload(client, "empty1", "user_a", "   ")
    assert empty.status_code == 422
