from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.core.enums import ConnectorKind
from draftlet_api.database.models import Capture


class CaptureRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_dedupe(
        self,
        connector_kind: ConnectorKind,
        source_message_id: str,
    ) -> Capture | None:
        # Database errors intentionally propagate to the API layer; empty results return None.
        return (
            await self.db.scalars(
                select(Capture).where(
                    Capture.connector_kind == connector_kind.value,
                    Capture.source_message_id == source_message_id,
                )
            )
        ).first()

    async def list(self, limit: int = 50) -> list[Capture]:
        # Database errors intentionally propagate to the API layer; empty results return [].
        return list(
            await self.db.scalars(
                select(Capture).order_by(Capture.captured_at.desc()).limit(limit)
            )
        )

    async def add(self, capture: Capture) -> Capture:
        self.db.add(capture)
        await self.db.commit()
        await self.db.refresh(capture)
        return capture
