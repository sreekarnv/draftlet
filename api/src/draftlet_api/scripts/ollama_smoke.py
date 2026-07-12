import asyncio

from draftlet_api.core.config import get_settings
from draftlet_api.services.ollama_client import OllamaClient


async def run() -> int:
    settings = get_settings()
    client = OllamaClient()

    print(f"Ollama base URL: {settings.ollama_base_url}")
    print(f"Default model:   {settings.ollama_default_model}")

    models = await client.list_models()
    print(f"Available models: {', '.join(models) if models else 'none'}")

    if settings.ollama_default_model not in models:
        print("Default model is not installed locally.")
        return 1

    print("Ollama is reachable.")
    return 0


def main() -> int:
    return asyncio.run(run())
