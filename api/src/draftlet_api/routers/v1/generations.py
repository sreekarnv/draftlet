from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.database.engine import get_db
from draftlet_api.dtos.draft import DraftRead
from draftlet_api.dtos.generation import GenerationCreate
from draftlet_api.services.runtime import RuntimeService

router = APIRouter(prefix="/generations", tags=["generations"])


@router.post("", response_model=DraftRead)
async def generate(data: GenerationCreate, db: AsyncSession = Depends(get_db)) -> DraftRead:
    return await RuntimeService(db).generate(data)
