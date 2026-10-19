"""Step 7: grounded answer generation. The model may only use retrieved passages."""
import logging
import re

from rag.retriever import RetrievedChunk
from rag.embeddings import embed_query, embed_texts
from services.llm_client import LLMError, get_llm

NOT_FOUND = "I could not find this information in the uploaded document."
log = logging.getLogger("ai-service.generator")

SYSTEM_PROMPT = f"""You are a careful legal-document analysis assistant.

Answer the user's question using ONLY the numbered source passages provided.

Rules:
1. If the passages do not contain the answer to a normal information question, reply with exactly: {NOT_FOUND}
2. Never use outside knowledge and never guess. Do not invent clauses, numbers, dates or parties.
3. Cite the passages you used with their numbers in square brackets, like [1] or [2][3].
4. Write in plain English, be concise, and quote exact figures, durations and amounts as written.
5. If passages conflict or the answer is partial, say so.
6. Do not give legal advice or tell the user what they should do.
7. When the user asks to list, map, or separate items, format one item per bullet line.
8. For questions asking whether the document contains or mentions something, inspect the closest passages. If they do not show it, say "I don't see [requested item] in the passages I found" and explain what related information the passages do show. Do not claim you checked the entire document unless the passages support that."""

CONDENSE_SYSTEM = """Rewrite the user's latest question so it can be understood without the earlier conversation.
Resolve pronouns and references (for example "it", "that clause", "what about the tenant?") using the conversation.
Return ONLY the rewritten question. If it is already standalone, return it unchanged."""


def condense_question(question: str, history: list[dict]) -> str:
    """Turns a follow-up like "what about early exit?" into a standalone search query."""
    llm = get_llm()
    if not history or llm.is_mock:
        return question
    # Most questions are already standalone; avoid a second provider request for them.
    follow_up = re.search(
        r"\b(it|they|them|that|those|these|there|former|latter)\b|"
        r"\b(what about|how about|and what|same clause|same thing)\b",
        question,
        re.IGNORECASE,
    )
    if not follow_up:
        return question
    convo = "\n".join(f"User: {h['question']}\nAssistant: {h['answer'][:400]}" for h in history[-3:])
    try:
        rewritten = llm.complete(CONDENSE_SYSTEM, f"Conversation:\n{convo}\n\nLatest question: {question}", max_tokens=150)
        rewritten = rewritten.strip().strip('"')
        return rewritten if 3 <= len(rewritten) <= 500 else question
    except LLMError:
        return question


def build_context(chunks: list[RetrievedChunk]) -> str:
    blocks = []
    for i, c in enumerate(chunks, start=1):
        label = f"[{i}] Page {c.page}" + (f", {c.clause}" if c.clause else "")
        blocks.append(f"{label}\n{c.text}")
    return "\n\n---\n\n".join(blocks)


def _extractive_answer(question: str, chunks: list[RetrievedChunk]) -> str:
    """Offline fallback: quote the sentences most relevant to the question."""
    best = chunks[0]
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", best.text) if len(s.strip()) > 15]
    if not sentences:
        sentences = [best.text.strip()]

    # The offline provider cannot compose an answer, but the semantic embedder
    # can still select the most useful sentences instead of quoting the chunk's start.
    sentences = sentences[:100]
    query_vector = embed_query(question)
    sentence_vectors = embed_texts(sentences)
    query_terms = set(re.findall(r"[a-z0-9]+", question.lower()))
    ranked = []
    for index, (sentence, vector) in enumerate(zip(sentences, sentence_vectors)):
        semantic = max(0.0, sum(q * s for q, s in zip(query_vector, vector)))
        terms = set(re.findall(r"[a-z0-9]+", sentence.lower()))
        lexical = len(query_terms & terms) / len(query_terms) if query_terms else 0.0
        ranked.append((0.85 * semantic + 0.15 * lexical, index, sentence))

    selected = sorted(ranked, key=lambda item: item[0], reverse=True)[:3]
    selected.sort(key=lambda item: item[1])
    excerpt = " ".join(item[2] for item in selected)[:600]
    where = f"page {best.page}" + (f", {best.clause}" if best.clause else "")
    return f"The most relevant passage ({where}) says: \"{excerpt}\" [1]"


def format_skill_list(document_text: str) -> str:
    """Extract a resume's categorized skills as readable one-skill-per-line bullets."""
    heading = re.search(r"\b(?:technical\s+)?skills\b", document_text, re.IGNORECASE)
    if not heading:
        return ""

    section = document_text[heading.end():]
    end = re.search(r"\b(?:projects?|experience|education|certifications?|achievements?)\b", section, re.IGNORECASE)
    if end:
        section = section[:end.start()]

    labels = re.compile(
        r"\b(programming languages|languages|core cs|frontend|backend|databases?|"
        r"problem solving|tools|frameworks?|libraries|platforms|cloud|devops|ai\s*/\s*ml)\s*:",
        re.IGNORECASE,
    )
    matches = list(labels.finditer(section))
    groups = []
    if matches:
        for index, match in enumerate(matches):
            stop = matches[index + 1].start() if index + 1 < len(matches) else len(section)
            raw_items = section[match.end():stop]
            items = re.split(r"[,;|\n•]+", raw_items)
            cleaned = [re.sub(r"\s+", " ", item).strip(" .:-") for item in items]
            cleaned = [item for item in cleaned if len(item) > 1]
            if cleaned:
                groups.append((match.group(1).strip().title(), cleaned))
    else:
        items = re.split(r"[,;|\n•]+", section)
        cleaned = [re.sub(r"\s+", " ", item).strip(" .:-") for item in items]
        cleaned = [item for item in cleaned if len(item) > 1]
        if cleaned:
            groups.append(("Skills", cleaned))

    if not groups:
        return ""
    lines = ["Technical skills:"]
    seen = set()
    for label, items in groups:
        lines.append(f"{label}:")
        for item in items:
            key = item.casefold()
            if key not in seen:
                lines.append(f"- {item}")
                seen.add(key)
    return "\n".join(lines)


def generate_answer(question: str, chunks: list[RetrievedChunk]) -> tuple[str, bool, list[RetrievedChunk]]:
    """Returns (answer, found, sources_actually_cited)."""
    if not chunks:
        return NOT_FOUND, False, []

    llm = get_llm()
    if llm.is_mock:
        return _extractive_answer(question, chunks), True, chunks[:1]

    user = f"Source passages:\n\n{build_context(chunks)}\n\nQuestion: {question}"
    try:
        answer = llm.complete(SYSTEM_PROMPT, user, max_tokens=350)
    except LLMError as exc:
        if llm.is_local and re.search(r"timed?\s*out|timeout", str(exc), re.IGNORECASE):
            log.warning("Local model timed out; using the top retrieved passage")
            return _extractive_answer(question, chunks), True, chunks[:1]
        raise
    if not answer.strip():
        # Some local model/server combinations can return a successful response
        # with an empty content field. Keep the answer grounded and saveable.
        log.warning("LLM returned an empty answer; using the top retrieved passage")
        return _extractive_answer(question, chunks), True, chunks[:1]

    if NOT_FOUND.lower() in answer.lower():
        return NOT_FOUND, False, []

    cited = sorted({int(n) for n in re.findall(r"\[(\d+)\]", answer) if 1 <= int(n) <= len(chunks)})
    if not cited:
        return answer, True, chunks[:2]

    # Renumber citations so [k] in the answer always means sources[k-1] in the response.
    mapping = {old: new for new, old in enumerate(cited, start=1)}
    answer = re.sub(
        r"\[(\d+)\]",
        lambda m: f"[{mapping[int(m.group(1))]}]" if int(m.group(1)) in mapping else "",
        answer,
    )
    return answer, True, [chunks[n - 1] for n in cited]
