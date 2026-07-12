from fastapi import APIRouter

from draftlet_api.services.ollama_client import OllamaClient

router = APIRouter(prefix="/ollama", tags=["ollama"])


@router.get("/models", response_model=list[str])
async def list_models() -> list[str]:
    return await OllamaClient().list_models()
