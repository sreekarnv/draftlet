from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.connectors.registry import connector_registry
from draftlet_api.connectors.telegram import auth as telegram_auth
from draftlet_api.database.engine import get_db
from draftlet_api.dtos.connector import (
    ConnectorCreate,
    ConnectorRead,
    ConnectorUpdate,
    TelegramAuthCodeRequest,
    TelegramAuthPasswordRequest,
    TelegramAuthStartRequest,
    TelegramAuthStatus,
    TelegramQrStart,
    TelegramQrStatus,
)
from draftlet_api.services.connector_service import ConnectorService

router = APIRouter(prefix="/connectors", tags=["connectors"])


async def _activate_telegram(db: AsyncSession, username: str | None) -> None:
    await ConnectorService(db).upsert(
        ConnectorCreate(
            kind="telegram",
            name="Telegram",
            enabled=True,
            config={"username": username},
        )
    )
    await connector_registry.start_all()


@router.get("", response_model=list[ConnectorRead])
async def list_connectors(db: AsyncSession = Depends(get_db)) -> list[ConnectorRead]:
    return await ConnectorService(db).list()


@router.post("", response_model=ConnectorRead)
async def create_connector(
    data: ConnectorCreate, db: AsyncSession = Depends(get_db)
) -> ConnectorRead:
    return await ConnectorService(db).create(data)


@router.patch("/{connector_id}", response_model=ConnectorRead)
async def update_connector(
    connector_id: UUID, data: ConnectorUpdate, db: AsyncSession = Depends(get_db)
) -> ConnectorRead:
    return await ConnectorService(db).update(connector_id, data)


@router.post("/telegram/auth/send-code", response_model=TelegramAuthStatus)
async def send_telegram_code(data: TelegramAuthStartRequest) -> TelegramAuthStatus:
    return await telegram_auth.send_code(data.phone)


@router.post("/telegram/auth/sign-in", response_model=TelegramAuthStatus)
async def sign_in_telegram(
    data: TelegramAuthCodeRequest, db: AsyncSession = Depends(get_db)
) -> TelegramAuthStatus:
    status = await telegram_auth.sign_in(data.phone, data.code, data.phone_code_hash)
    if status.connected:
        await _activate_telegram(db, status.username)
    return status


@router.post("/telegram/auth/sign-in-password", response_model=TelegramAuthStatus)
async def sign_in_telegram_password(
    data: TelegramAuthPasswordRequest, db: AsyncSession = Depends(get_db)
) -> TelegramAuthStatus:
    status = await telegram_auth.sign_in_password(data.password)
    if status.connected:
        await _activate_telegram(db, status.username)
    return status


@router.post("/telegram/auth/qr/start", response_model=TelegramQrStart)
async def start_telegram_qr() -> TelegramQrStart:
    return await telegram_auth.start_qr()


@router.get("/telegram/auth/qr/status", response_model=TelegramQrStatus)
async def telegram_qr_status(db: AsyncSession = Depends(get_db)) -> TelegramQrStatus:
    status = telegram_auth.qr_status()
    if status.connected:
        await _activate_telegram(db, status.username)
    return status


@router.post("/telegram/auth/qr/cancel", response_model=TelegramQrStatus)
async def cancel_telegram_qr() -> TelegramQrStatus:
    return await telegram_auth.cancel_qr()


@router.post("/telegram/auth/disconnect", response_model=TelegramAuthStatus)
async def disconnect_telegram(db: AsyncSession = Depends(get_db)) -> TelegramAuthStatus:
    status = await telegram_auth.disconnect()
    existing = next(
        (item for item in await ConnectorService(db).list() if item.kind == "telegram"),
        None,
    )
    if existing:
        await ConnectorService(db).update(
            existing.id, ConnectorUpdate(enabled=False, config={})
        )
    await connector_registry.stop_all()
    return status


@router.get("/telegram/auth/status", response_model=TelegramAuthStatus)
async def telegram_status() -> TelegramAuthStatus:
    return await telegram_auth.current_status()
