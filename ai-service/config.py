import os

from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")  # ChromaDB: never send usage data


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


class Settings:
    internal_key: str = os.getenv("AI_INTERNAL_KEY", "dev-internal-key")

    llm_provider: str = os.getenv("LLM_PROVIDER", "anthropic").lower()
    llm_model: str = os.getenv("LLM_MODEL", "claude-sonnet-5-5")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "")

    embedding_model: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

    chunk_size: int = _int("CHUNK_SIZE", 900)
    chunk_overlap: int = _int("CHUNK_OVERLAP", 150)

    top_k: int = _int("TOP_K", 5)
    min_relevance: float = _float("MIN_RELEVANCE", 0.22)

    chroma_dir: str = os.getenv("CHROMA_DIR", "./data/chroma")
    text_dir: str = os.getenv("TEXT_DIR", "./data/texts")
    max_upload_mb: int = _int("MAX_UPLOAD_MB", 20)

    # DOCX/TXT have no real pages, so text is grouped into "virtual pages" of about this many characters.
    virtual_page_chars: int = _int("VIRTUAL_PAGE_CHARS", 3000)

    # Prompts larger than this are summarised with map-reduce instead of a single call.
    max_direct_chars: int = _int("MAX_DIRECT_CHARS", 45000)
    max_analysis_chars: int = _int("MAX_ANALYSIS_CHARS", 60000)


settings = Settings()
