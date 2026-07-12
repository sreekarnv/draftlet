from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.core.errors import NotFoundError
from draftlet_api.dtos.connector import ConnectorRead, ConnectorUpdate
from draftlet_api.repositories.connector_repository import ConnectorRepository


class ConnectorService:
    def __init__(self, db: AsyncSession):
        self.repository = ConnectorRepository(db)

    async def list(self) -> list[ConnectorRead]:
        return [
            ConnectorRead.model_validate(connector)
            for connector in await self.repository.list()
        ]

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
