from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.database.engine import get_db
from draftlet_api.dtos.draft import (
    DraftCreate,
    DraftList,
    DraftRead,
    DraftUpdate,
    DraftVariantCreate,
    DraftVariantGenerate,
    DraftVariantRead,
)
from draftlet_api.services.runtime import RuntimeService, draft_dto

router = APIRouter(prefix="/drafts", tags=["drafts"])


@router.get("", response_model=DraftList)
async def list_drafts(
    conversation_id: UUID | None = None, db: AsyncSession = Depends(get_db)
) -> DraftList:
    return DraftList(items=await RuntimeService(db).drafts(conversation_id))


@router.post("", response_model=DraftRead, status_code=status.HTTP_201_CREATED)
async def create_draft(
    data: DraftCreate, db: AsyncSession = Depends(get_db)
) -> DraftRead:
    return await RuntimeService(db).create_draft(data)


@router.get("/{draft_id}", response_model=DraftRead)
async def get_draft(draft_id: UUID, db: AsyncSession = Depends(get_db)) -> DraftRead:
    return draft_dto(await RuntimeService(db).draft(draft_id))


@router.patch("/{draft_id}", response_model=DraftRead)
async def update_draft(
    draft_id: UUID, data: DraftUpdate, db: AsyncSession = Depends(get_db)
) -> DraftRead:
    return await RuntimeService(db).update_draft(draft_id, data)


@router.post(
    "/{draft_id}/variants",
    response_model=DraftVariantRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_variant(
    draft_id: UUID, data: DraftVariantCreate, db: AsyncSession = Depends(get_db)
) -> DraftVariantRead:
    return await RuntimeService(db).add_variant(draft_id, data)


@router.post(
    "/{draft_id}/variants/generate",
    response_model=DraftVariantRead,
    status_code=status.HTTP_201_CREATED,
)
async def generate_variant(
    draft_id: UUID, data: DraftVariantGenerate, db: AsyncSession = Depends(get_db)
) -> DraftVariantRead:
    return await RuntimeService(db).generate_variant(draft_id, data)


@router.post("/{draft_id}/accept", response_model=DraftRead)
async def accept_draft(draft_id: UUID, db: AsyncSession = Depends(get_db)) -> DraftRead:
    return await RuntimeService(db).accept(draft_id)


@router.post("/{draft_id}/mark-sent", response_model=DraftRead)
async def mark_sent(draft_id: UUID, db: AsyncSession = Depends(get_db)) -> DraftRead:
    return await RuntimeService(db).update_draft(draft_id, DraftUpdate(status="sent"))
