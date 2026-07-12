from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.database.engine import get_db
from draftlet_api.dtos.health import ComponentHealth, HealthRead
from draftlet_api.services.ollama_client import OllamaClient

health_router = APIRouter(tags=["health"])


@health_router.get("/health", response_model=HealthRead)
async def health(db: AsyncSession = Depends(get_db)) -> HealthRead:
    try:
        await db.execute(text("SELECT 1"))
        database = ComponentHealth(ok=True)
    except Exception as error:
        database = ComponentHealth(ok=False, detail=str(error))

    ollama_ok = await OllamaClient().health()
    return HealthRead(
        status="ok" if database.ok else "degraded",
        version="1.0.0-alpha1",
        database=database,
        ollama=ComponentHealth(
            ok=ollama_ok,
            detail=None if ollama_ok else "Ollama is not reachable",
        ),
    )
