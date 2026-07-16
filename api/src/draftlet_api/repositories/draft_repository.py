from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from draftlet_api.database.models import Draft, DraftVariant


class DraftRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, conversation_id: UUID | None = None) -> list[Draft]:
        query = (
            select(Draft)
            .options(selectinload(Draft.variants))
            .order_by(Draft.updated_at.desc())
        )
        if conversation_id:
            query = query.where(Draft.conversation_id == conversation_id)
        return list(await self.db.scalars(query))

    async def get(self, draft_id: UUID) -> Draft | None:
        return (
            await self.db.scalars(
                select(Draft)
                .where(Draft.id == draft_id)
                .options(selectinload(Draft.variants))
            )
        ).first()

    async def save(self, draft: Draft) -> Draft:
        self.db.add(draft)
        await self.db.commit()
        return await self.get(draft.id) or draft

    async def add_variant(self, draft: Draft, variant: DraftVariant) -> DraftVariant:
        self.db.add(variant)
        await self.db.commit()
        await self.db.refresh(variant)
        return variant
