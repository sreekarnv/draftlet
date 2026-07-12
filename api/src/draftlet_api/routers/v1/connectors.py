from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.database.engine import get_db
from draftlet_api.dtos.connector import ConnectorRead, ConnectorUpdate
from draftlet_api.services.connector_service import ConnectorService

router = APIRouter(prefix="/connectors", tags=["connectors"])


@router.get("", response_model=list[ConnectorRead])
async def list_connectors(db: AsyncSession = Depends(get_db)) -> list[ConnectorRead]:
    return await ConnectorService(db).list()


@router.patch("/{connector_id}", response_model=ConnectorRead)
async def update_connector(connector_id: UUID, data: ConnectorUpdate, db: AsyncSession = Depends(get_db)) -> ConnectorRead:
    return await ConnectorService(db).update(connector_id, data)
