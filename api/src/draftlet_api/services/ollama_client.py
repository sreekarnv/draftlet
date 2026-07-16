import httpx

from draftlet_api.core.config import get_settings
from draftlet_api.core.errors import ProviderError


class OllamaClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=1.0) as client:
                response = await client.get(f"{self.settings.ollama_base_url}/api/tags")
                response.raise_for_status()

            return True
        except httpx.HTTPError:
            return False

    async def list_models(self) -> list[str]:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.settings.ollama_base_url}/api/tags")
                response.raise_for_status()
                payload = response.json()
                return [item["name"] for item in payload.get("models", []) if "name" in item]
        except httpx.HTTPError as error:
            raise ProviderError(f"Ollama is unavailable: {error}") from error

    async def chat(
        self, messages: list[dict[str, str]], model: str | None = None
    ) -> str:
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.settings.ollama_base_url}/api/chat",
                    json={
                        "model": model or self.settings.ollama_default_model,
                        "messages": messages,
                        "stream": False,
                    },
                )
                response.raise_for_status()
                return response.json()["message"]["content"]
        except (httpx.HTTPError, KeyError) as error:
            raise ProviderError(f"Ollama is unavailable: {error}") from error
