# Legal Document Analyzer

An AI-powered web app for understanding legal documents. Users upload a contract (PDF, DOCX or TXT), then get a plain-English **summary**, a **risk review** with suggestions, a map of the **clauses** found or missing, and a **chat** that answers questions *only from the uploaded document* with page and clause citations (Retrieval-Augmented Generation).

> AI output is informational and is **not legal advice**. The UI says so wherever analysis is shown.

## Features

| Area | What it does |
|---|---|
| **Authentication** | Register, login, logout, bcrypt password hashing, JWT access + rotating refresh tokens, token validation on load, forgot/reset password (emailed one-time link), change password, account lockout after 5 failed logins, delete account |
| **Authorization** | Every document, chat and analysis is scoped to its owner. Other users get `404`, never `403`, so document existence is not leaked |
| **Documents** | PDF/DOCX/TXT upload with extension + MIME + magic-byte checks, size limit, duplicate detection (SHA-256), background processing with live status, retry, download, delete (removes file, vectors, text and chats) |
| **RAG pipeline** | Extract → clean → chunk → embed → vector DB (ChromaDB), then hybrid retrieval → grounded generation with citations |
| **Chat** | Follow-up questions are rewritten into standalone queries, answers cite sources `[1]`, "not found" is returned instead of guessing, history per document and across documents |
| **Analysis** | Structured summary, risk detection (rules + LLM review, High/Medium/Low), clause detection with plain-English explanations, missing-clause warnings, exportable Markdown report |
| **Dashboard** | Totals, risk distribution, recent documents and questions |
| **Security & ops** | Helmet, CORS allow-list, NoSQL-injection sanitising, rate limiting (global, auth, per-user AI/upload), input validation, audit log (90-day TTL), service-to-service key, health checks, Docker, CI |

## Architecture

```
 React (Vite, Tailwind)
        │  HTTPS + JWT (Authorization: Bearer)
        ▼
 Node.js / Express API ──────────► MongoDB  (users, documents, chats, audit log, revoked tokens)
        │  X-Internal-Key (shared secret, private network only)
        │  files stay in backend/uploads/<userId>/ (never served statically)
        ▼
 FastAPI AI service
   loader → cleaner → splitter → embeddings → ChromaDB (user_id + document_id on every vector)
   retriever (dense + keyword re-rank) → generator (LLM, grounded prompt)
   summarizer · risk analyzer · clause detector
```

**Why two backends?** Node handles auth, users and the product API; Python owns the ML ecosystem (PyMuPDF, sentence-transformers, ChromaDB). The AI service is never exposed publicly: in Docker it has no published port.

## Quick start

### Option A: Docker (everything)
```bash
cp .env.example .env          # fill the three secrets and your LLM key
docker compose up --build
# open http://localhost:8080
```
Generate secrets with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

### Option B: local development
Prerequisites: Node 18+, Python 3.10+, MongoDB running locally (or an Atlas URI).

```bash
# 1. AI service
cd ai-service
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env     # set ANTHROPIC_API_KEY, or LLM_PROVIDER=mock to try it without a key
uvicorn main:app --reload --port 8000

# 2. Backend
cd backend
npm install
cp .env.example .env     # AI_INTERNAL_KEY must equal the one in ai-service/.env
npm run dev              # http://localhost:5000

# 3. Frontend
cd frontend
npm install
npm run dev              # http://localhost:5173  (proxies /api to :5000)
```
A sample contract to try is in `samples/sample_lease.txt`. Ask it: *"How much notice is needed to terminate early?"*

**No API key?** Set `LLM_PROVIDER=mock`. Answers become extractive (the best passage is quoted) and analysis uses the rule-based detectors only. This is enough to demo the whole flow offline.

**Password reset without SMTP:** the reset link is printed in the backend log and shown on the Forgot-password screen in development.

### LLM providers
| `LLM_PROVIDER` | Notes |
|---|---|
| `anthropic` | Set `ANTHROPIC_API_KEY`; model via `LLM_MODEL` (default `claude-sonnet-5-5`, change to any model you have access to) |
| `openai` | `OPENAI_API_KEY`; or `OPENAI_BASE_URL` for any OpenAI-compatible server (e.g. Ollama at `http://localhost:11434/v1`) |
| `mock` | No key, fully offline |

## RAG design decisions (good viva material)

1. **Chunking: 900 characters, 150 overlap, per page.** `all-MiniLM-L6-v2` reads about 256 tokens, roughly 1000 characters; larger chunks would be silently truncated when embedded. Chunks never cross pages, so every citation has an exact page number. Overlap keeps a sentence that straddles a boundary retrievable. Both values are env-configurable.
2. **Clause references.** A regex tags each chunk with `Clause 8.2`, `Section 4` etc. when present, so answers can cite "Page 4, Clause 8.2".
3. **Hybrid retrieval.** Dense cosine similarity (80%) plus keyword overlap (20%). Legal text relies on exact terms ("indemnify", "30 days") that pure embeddings can blur.
4. **Relevance threshold.** If nothing scores above `MIN_RELEVANCE`, the LLM is **not called** and the app answers *"I could not find this information in the uploaded document."* This stops hallucination and saves cost.
5. **Grounded prompt.** The model may only use the numbered passages, must cite them, and must return the exact "not found" sentence when the answer is missing. Citation numbers are renumbered server-side so `[k]` always equals `sources[k-1]`.
6. **Follow-up questions.** "What about early exit?" is rewritten into a standalone question using the last turns before retrieval.
7. **Multi-tenant safety.** Every vector carries `user_id` + `document_id`; every query filters on both; text files are stored under `data/texts/<user_id>/`; IDs are regex-validated (no path traversal). Tests prove another user cannot read or query a document even if they know its id.
8. **Hybrid risk detection.** 13 deterministic regex rules always run (fast, free, explainable). When an LLM is configured it reviews the document with the rule hits as hints, confirms or drops them, and adds what rules miss. If the LLM fails, rule results still return.
9. **Long documents.** Summaries over ~45k characters use map-reduce (notes per section, then a final structured summary).
10. **Scanned PDFs** have no text layer; the service returns a clear message asking for OCR. (See Future work.)

## Security checklist

- bcrypt (cost 12); passwords never stored or logged; strong-password policy (client and server)
- JWT access (30 min) + refresh (7 days) tokens, **refresh rotation** with reuse detection, logout revokes both (`jti` blacklist with TTL cleanup), `tokenVersion` kills all sessions on password change/reset
- Login does not reveal whether an email exists; forgot-password responds identically either way; reset tokens are random, stored **hashed**, expire in 15 min and are single-use
- Account lockout (5 failures, 15 min) and rate limits on auth, AI and upload endpoints
- Helmet headers, CORS allow-list, `express-mongo-sanitize`, `express-validator`, JSON body limit
- Upload validation: extension, MIME type, magic bytes; size cap; random stored filenames; files kept outside any static directory; duplicate detection
- Ownership checked in one middleware (`loadOwnedDocument`) for every document/chat route
- AI service requires `X-Internal-Key` (constant-time compare) and is not publicly exposed
- Secrets only from environment variables; production refuses to start with placeholder secrets
- Audit log of logins, failures, uploads, deletions, analysis and password events

**Known trade-off:** tokens are stored in `localStorage` for simplicity, which is readable by injected scripts (XSS). The app uses React's escaping and no `dangerouslySetInnerHTML`, but for a stricter deployment move the refresh token to an `httpOnly; SameSite=Strict` cookie.

## API reference (Node)

All routes are under `/api`. Protected routes need `Authorization: Bearer <accessToken>`.

| Method & path | Purpose |
|---|---|
| `POST /auth/register` · `POST /auth/login` | Create account / sign in → `{user, accessToken, refreshToken}` |
| `POST /auth/refresh` | Rotate tokens |
| `POST /auth/logout` 🔒 | Revoke current tokens |
| `GET /auth/validate` 🔒 | Confirm the session is valid |
| `POST /auth/forgot-password` · `POST /auth/reset-password` | Emailed one-time reset flow |
| `POST /auth/change-password` 🔒 | Change password (signs out other sessions) |
| `GET /documents` 🔒 | List (`search`, `status`, `risk`, `page`, `limit`) |
| `POST /documents` 🔒 | Upload (`multipart`, field `file`) → `201`, processing runs in background |
| `GET /documents/:id` 🔒 | Detail incl. analysis |
| `GET /documents/:id/download` · `/report` 🔒 | Original file · Markdown analysis report |
| `POST /documents/:id/analyze` 🔒 | Run summary + risks + clauses |
| `POST /documents/:id/reprocess` 🔒 | Retry a failed document |
| `DELETE /documents/:id` 🔒 | Delete file, vectors, chats |
| `POST /chat/:documentId` 🔒 | Ask `{question}` → answer + sources |
| `GET/DELETE /chat/:documentId` 🔒 | Conversation for a document |
| `GET /chat` 🔒 | History across documents (`search`, `documentId`, `page`) |
| `GET /dashboard/stats` 🔒 | Dashboard figures |
| `GET/PUT /user/profile`, `GET /user/activity`, `DELETE /user/account` 🔒 | Profile, audit trail, delete account |
| `GET /health` | DB + AI service status |

**AI service** (internal, header `X-Internal-Key`; interactive docs at `http://localhost:8000/docs`):
`POST /process-document` · `/ask` · `/retrieve` · `/embed` · `/summarize` · `/analyze-risk` · `/detect-clauses` · `DELETE /documents/{id}?user_id=` · `GET /health`.

## Data model

- **User**: name, email, passwordHash, tokenVersion, reset-token hash + expiry, failedLoginAttempts, lockUntil
- **Document**: userId, original/stored name, filePath (hidden from API), type, size, sha256, status, page/chunk/word counts, analysisStatus, analysis {summary, risks[], riskLevel, clauses[], missingClauses[]}
- **Chat**: userId, documentId, question, answer, found, sources[{page, clause, text, score}]
- **RevokedToken** (TTL), **AuditLog** (TTL 90 days)
- **Vector store** (Chroma): chunk text, embedding, `user_id`, `document_id`, `page`, `clause`, `chunk_index`

## Tests

```bash
cd backend    && npm test             # 17 unit tests (validation, auth gates, tokens, upload signatures, report); no DB needed
cd ai-service && python -m pytest -q  # 24 tests incl. full API flow + cross-user isolation (offline embedder + mock LLM)
cd frontend   && npm run build

# Full-stack checks against a RUNNING system (MongoDB + ai-service + backend):
cd backend && npm run e2e             # 54 API checks: auth, isolation, upload, analysis, chat, reset, refresh rotation, lockout, delete
APP=http://localhost:5173 python e2e/ui_flow.py   # 17-step browser journey with Playwright
```
CI (`.github/workflows/ci.yml`) runs the unit tests and the frontend build.

### What has been verified, and what has not

**Verified** in the environment this project was generated in: all of the above passed together, including the 54 API checks and the 17-step browser journey, against the real Express app, the real FastAPI service, ChromaDB and a MongoDB-compatible database (FerretDB). Running them also found and fixed real bugs (a dashboard aggregation, a header/footer cleaner, citation numbering, a dialog that blocked cancelling).

**Not verified there, so please check on your machine:**
- **A real `mongod` / Atlas.** The e2e ran on FerretDB, which speaks the MongoDB protocol. Run `npm run e2e` against your own MongoDB to confirm.
- **The real embedding model** (`all-MiniLM-L6-v2`). Tests use the offline hashing embedder because the model download was not reachable. Retrieval *quality* and the `MIN_RELEVANCE=0.22` threshold should be tuned on your own documents.
- **A live LLM.** Tests use `LLM_PROVIDER=mock`. The Anthropic/OpenAI code paths are written to each SDK's documented API but have not made a real call. If the model name in `LLM_MODEL` is wrong for your account you will see a clear 502 from the AI service.
- **Docker images / `docker compose up`.** The files are syntax-checked only.
- **Email delivery.** Without SMTP the reset link is shown on screen; with SMTP it uses Nodemailer.

## Project structure

```
legal-document-analyzer/
├── frontend/      React + Vite + Tailwind (pages, components, context, services)
├── backend/       Express API (controllers, middleware, models, routes, services, utils, tests)
├── ai-service/    FastAPI + RAG (rag/, services/, models/, tests/)
├── e2e/           ui_flow.py (browser journey), backend/scripts/e2e.js (API checks)
├── samples/       sample_lease.txt
├── docker-compose.yml, .github/workflows/ci.yml, .env.example
```

## Future work (to mention in the report)

- OCR for scanned PDFs (Tesseract / cloud OCR)
- Streaming answers (SSE) and a cross-encoder re-ranker
- Compare two versions of a contract; redline view
- Move the vector store to a managed service (Qdrant/pgvector) and uploads to S3 for horizontal scaling
- Background job queue (BullMQ/Celery) instead of in-process processing
- Email verification, 2FA, role-based admin console
- Evaluation set measuring retrieval recall and answer faithfulness
- Multi-language documents (multilingual embedding model)

## Viva cheat-sheet

- **Why RAG instead of pasting the document into a chat?** Contracts exceed context limits and cost; retrieval sends only the relevant passages, enables page citations, and lets us refuse when the answer is absent.
- **How do you stop hallucination?** Relevance threshold before the LLM is called, a prompt restricted to numbered passages, a mandatory "not found" reply, and citations the user can check.
- **How do you keep users' data separate?** Ownership middleware on the API, `user_id` filter on every vector query, per-user storage folders, and tests for cross-user access.
- **Why refresh-token rotation?** A stolen refresh token can be used only once; reuse is detected and rejected.
- **Why hybrid risk detection?** Rules are deterministic and explainable; the LLM adds judgement and context; the system degrades gracefully if the LLM is down.
