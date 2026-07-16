from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.database.models import Connector


class ConnectorRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self) -> list[Connector]:
        return list(await self.db.scalars(select(Connector).order_by(Connector.name)))

    async def get(self, connector_id: UUID):
        return await self.db.get(Connector, connector_id)

    async def get_by_kind(self, kind: str):
        return (
            await self.db.scalars(select(Connector).where(Connector.kind == kind))
        ).first()

    async def save(self, connector: Connector) -> Connector:
        self.db.add(connector)
        await self.db.commit()
        await self.db.refresh(connector)
        return connector
