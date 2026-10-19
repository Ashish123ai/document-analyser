from pydantic import BaseModel, Field

ID_PATTERN = r"^[A-Za-z0-9_-]{1,64}$"


class DocRef(BaseModel):
    document_id: str = Field(pattern=ID_PATTERN)
    user_id: str = Field(pattern=ID_PATTERN)


class HistoryTurn(BaseModel):
    question: str = Field(max_length=1000)
    answer: str = Field(max_length=6000)


class AskRequest(DocRef):
    question: str = Field(min_length=3, max_length=1000)
    history: list[HistoryTurn] = Field(default_factory=list, max_length=10)
    top_k: int = Field(5, ge=1, le=10)


class Source(BaseModel):
    page: int
    clause: str | None = None
    text: str
    score: float


class AskResponse(BaseModel):
    answer: str
    found: bool
    sources: list[Source]
    standalone_question: str


class ProcessResponse(BaseModel):
    page_count: int
    chunk_count: int
    word_count: int


class RetrieveRequest(DocRef):
    query: str = Field(min_length=2, max_length=1000)
    top_k: int = Field(5, ge=1, le=20)


class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=64)


class RiskItem(BaseModel):
    title: str
    level: str
    category: str
    page: int | None = None
    clause_ref: str | None = None
    clause_text: str = ""
    explanation: str = ""
    recommendation: str = ""


class RiskResponse(BaseModel):
    risk_level: str
    risks: list[RiskItem]


class ClauseItem(BaseModel):
    type: str
    label: str
    page: int
    clause_ref: str | None = None
    excerpt: str
    explanation: str


class ClauseResponse(BaseModel):
    clauses: list[ClauseItem]
    missing: list[str]
