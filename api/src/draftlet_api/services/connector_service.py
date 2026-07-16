from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.core.errors import NotFoundError
from draftlet_api.database.models import Connector
from draftlet_api.dtos.connector import ConnectorCreate, ConnectorRead, ConnectorUpdate
from draftlet_api.repositories.connector_repository import ConnectorRepository


class ConnectorService:
    def __init__(self, db: AsyncSession):
        self.repository = ConnectorRepository(db)

    async def list(self) -> list[ConnectorRead]:
        return [
            ConnectorRead.model_validate(connector)
            for connector in await self.repository.list()
        ]

    async def create(self, payload: ConnectorCreate) -> ConnectorRead:
        existing = await self.repository.get_by_kind(payload.kind)
        if existing:
            return ConnectorRead.model_validate(existing)

        connector = Connector(**payload.model_dump())
        return ConnectorRead.model_validate(await self.repository.save(connector))

    async def upsert(self, payload: ConnectorCreate) -> ConnectorRead:
        existing = await self.repository.get_by_kind(payload.kind)
        if existing:
            for key, value in payload.model_dump(exclude_unset=True).items():
                setattr(existing, key, value)
            return ConnectorRead.model_validate(await self.repository.save(existing))

        return await self.create(payload)

    async def update(
        self,
        connector_id: UUID,
        payload: ConnectorUpdate,
    ) -> ConnectorRead:
        connector = await self.repository.get(connector_id)
        if not connector:
            raise NotFoundError("connector", str(connector_id))

        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(connector, key, value)

        return ConnectorRead.model_validate(await self.repository.save(connector))
