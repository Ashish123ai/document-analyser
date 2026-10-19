"""Provider-agnostic LLM wrapper: Anthropic, OpenAI-compatible servers, or an offline mock."""
import json
import logging
import re
import time
from urllib.parse import urlparse

from config import settings

log = logging.getLogger("llm")


class LLMError(Exception):
    pass


class LLMClient:
    def __init__(self) -> None:
        self.provider = settings.llm_provider
        self._client = None

        if self.provider == "anthropic" and not settings.anthropic_api_key:
            log.warning("ANTHROPIC_API_KEY is not set: falling back to LLM_PROVIDER=mock")
            self.provider = "mock"
        if self.provider == "openai" and not (settings.openai_api_key or settings.openai_base_url):
            log.warning("OPENAI_API_KEY is not set: falling back to LLM_PROVIDER=mock")
            self.provider = "mock"

    @property
    def is_mock(self) -> bool:
        return self.provider == "mock"

    @property
    def is_local(self) -> bool:
        return self.provider == "openai" and urlparse(settings.openai_base_url).hostname in {
            "localhost", "127.0.0.1", "::1",
        }

    # ---------------------------------------------------------------- public API
    def complete(self, system: str, user: str, max_tokens: int = 1200, temperature: float = 0.0) -> str:
        if self.is_mock:
            raise LLMError("The mock provider cannot generate free text")
        last: Exception | None = None
        # Local inference is already running on this machine; retrying a slow
        # generation doubles the wait and competes for the same local resources.
        # Remote providers get one retry for transient failures.
        attempts = 1 if self.is_local else 2
        for attempt in range(attempts):
            try:
                if self.provider == "anthropic":
                    return self._anthropic(system, user, max_tokens, temperature)
                if self.provider == "openai":
                    return self._openai(system, user, max_tokens, temperature)
                raise LLMError(f"Unknown LLM_PROVIDER '{self.provider}'")
            except LLMError:
                raise
            except Exception as exc:  # network, provider, or model-server error
                status = getattr(exc, "status_code", None) or getattr(getattr(exc, "response", None), "status_code", None)
                if status in {400, 401, 403, 404, 413, 422, 429}:
                    raise LLMError(f"The model rejected the request (HTTP {status}): {exc}") from exc
                last = exc
                log.warning("LLM call failed (attempt %d/%d): %s", attempt + 1, attempts, exc)
                if attempt + 1 < attempts:
                    time.sleep(0.5)
        raise LLMError(f"The language model request failed: {last}")

    def complete_json(self, system: str, user: str, max_tokens: int = 2500):
        text = self.complete(system, user, max_tokens=max_tokens)
        return parse_json(text)

    # ---------------------------------------------------------------- providers
    def _anthropic(self, system: str, user: str, max_tokens: int, temperature: float) -> str:
        import anthropic

        if self._client is None:
            self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=75.0, max_retries=0)
        kwargs = dict(
            model=settings.llm_model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        try:
            msg = self._client.messages.create(temperature=temperature, **kwargs)
        except anthropic.BadRequestError as exc:
            if "temperature" not in str(exc).lower():
                raise LLMError(f"Request rejected by the model API: {exc}") from exc
            msg = self._client.messages.create(**kwargs)  # some models do not accept a temperature
        return "".join(block.text for block in msg.content if getattr(block, "type", "") == "text").strip()

    def _openai(self, system: str, user: str, max_tokens: int, temperature: float) -> str:
        from openai import OpenAI

        if self._client is None:
            self._client = OpenAI(
                api_key=settings.openai_api_key or "not-needed",
                base_url=settings.openai_base_url or None,
                timeout=45.0 if self.is_local else 75.0,
                max_retries=0,
            )
        request_options = {}
        # Qwen 3.5 can return its reasoning separately from the final content.
        # Ollama exposes a `think` option; disabling it here keeps the API's
        # content field populated with a concise answer for the chat UI.
        if urlparse(settings.openai_base_url).hostname in {"localhost", "127.0.0.1", "::1"}:
            request_options["extra_body"] = {"think": False}
        res = self._client.chat.completions.create(
            model=settings.llm_model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            **request_options,
        )
        return (res.choices[0].message.content or "").strip()


def parse_json(text: str):
    """Parses model output as JSON, tolerating code fences and surrounding prose."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    for opener, closer in (("{", "}"), ("[", "]")):
        start, end = cleaned.find(opener), cleaned.rfind(closer)
        if start != -1 and end > start:
            try:
                return json.loads(cleaned[start : end + 1])
            except json.JSONDecodeError:
                continue
    raise LLMError("The model did not return valid JSON")


_llm: LLMClient | None = None


def get_llm() -> LLMClient:
    global _llm
    if _llm is None:
        _llm = LLMClient()
    return _llm
