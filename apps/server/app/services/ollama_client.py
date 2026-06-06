from collections.abc import AsyncIterator
import json

import httpx


class OllamaClientError(RuntimeError):
    pass


async def stream_ollama_generate(
    *,
    base_url: str,
    model: str,
    prompt: str,
) -> AsyncIterator[str]:
    url = f"{base_url.rstrip('/')}/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": True,
    }

    try:
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", url, json=payload) as response:
                if response.is_error:
                    body = await response.aread()
                    detail = body.decode(errors="replace").strip() or response.reason_phrase
                    raise OllamaClientError(
                        f"Ollama request failed with {response.status_code}: {detail}"
                    )

                async for line in response.aiter_lines():
                    if not line:
                        continue

                    data = json.loads(line)
                    chunk = data.get("response")

                    if isinstance(chunk, str) and chunk:
                        yield chunk

                    if data.get("done") is True:
                        break
    except httpx.RequestError as error:
        raise OllamaClientError(f"Could not connect to Ollama at {url}: {error}") from error
