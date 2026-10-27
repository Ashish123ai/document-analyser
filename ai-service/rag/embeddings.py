"""Step 4: embeddings. Turns text into vectors for semantic search."""
import hashlib
import math
import re
import threading

from config import settings

_lock = threading.Lock()
_model = None


class HashingEmbedder:
    """Tiny offline embedder using hashed word/bigram features.

    Not semantically strong. It exists so tests, CI and offline demos run without downloading a model.
    Enable with EMBEDDING_MODEL=hashing.
    """

    dim = 384

    def encode(self, texts: list[str]) -> list[list[float]]:
        return [self._vector(t) for t in texts]

    def _vector(self, text: str) -> list[float]:
        words = re.findall(r"[a-z0-9]+", text.lower())
        features = words + [f"{a}_{b}" for a, b in zip(words, words[1:])]
        vec = [0.0] * self.dim
        for feat in features:
            h = int(hashlib.md5(feat.encode()).hexdigest(), 16)
            vec[h % self.dim] += 1.0 if (h >> 20) & 1 else -1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]


def model_name() -> str:
    return settings.embedding_model


def _get_model():
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                if settings.embedding_model == "hashing":
                    _model = HashingEmbedder()
                else:
                    from sentence_transformers import SentenceTransformer

                    _model = SentenceTransformer(settings.embedding_model)
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    model = _get_model()
    if isinstance(model, HashingEmbedder):
        return model.encode(texts)
    return model.encode(
        texts,
        batch_size=settings.embedding_batch_size,
        normalize_embeddings=True,
        show_progress_bar=False,
    ).tolist()


def embed_query(text: str) -> list[float]:
    return embed_texts([text])[0]


def warm_up() -> None:
    _get_model()
