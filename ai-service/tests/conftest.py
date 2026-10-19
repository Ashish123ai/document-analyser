import os
import sys
import tempfile

# Configure BEFORE the app modules are imported: offline embedder, mock LLM, temp storage.
_tmp = tempfile.mkdtemp(prefix="legal-ai-tests-")
os.environ.update(
    EMBEDDING_MODEL="hashing",
    LLM_PROVIDER="mock",
    CHROMA_DIR=os.path.join(_tmp, "chroma"),
    TEXT_DIR=os.path.join(_tmp, "texts"),
    AI_INTERNAL_KEY="test-key",
    MIN_RELEVANCE="0.08",
    SKIP_WARMUP="1",
    VIRTUAL_PAGE_CHARS="1200",
)
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
