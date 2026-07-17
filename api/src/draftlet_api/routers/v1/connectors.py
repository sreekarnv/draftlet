from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from draftlet_api.connectors.gmail.mapper import GmailCapture, capture_from_gmail
from draftlet_api.connectors.registry import connector_registry
from draftlet_api.connectors.telegram import auth as telegram_auth
from draftlet_api.core.errors import NotFoundError
from draftlet_api.database.engine import get_db
from draftlet_api.database.models import Conversation, Draft
from draftlet_api.dtos.capture import CaptureRead
from draftlet_api.dtos.connector import (
    ConnectorCreate,
    ConnectorDaemonStatusRead,
    ConnectorRead,
    ConnectorUpdate,
    TelegramAuthCodeRequest,
    TelegramAuthPasswordRequest,
    TelegramAuthStartRequest,
    TelegramAuthStatus,
    TelegramQrStart,
    TelegramQrStatus,
)
from draftlet_api.services.capture_service import CaptureService
from draftlet_api.services.connector_service import ConnectorService

router = APIRouter(prefix="/connectors", tags=["connectors"])


class GmailLatestDraftRead(BaseModel):
    draft_id: UUID
    conversation_id: UUID
    subject: str
    text: str
    gmail_url: str | None = None
    updated_at: str


async def _activate_telegram(db: AsyncSession, username: str | None) -> None:
    await ConnectorService(db).upsert(
        ConnectorCreate(
            kind="telegram",
            name="Telegram",
            enabled=True,
            config={"username": username},
        )
    )
    await connector_registry.start("telegram")


def _daemon_status(kind: str) -> ConnectorDaemonStatusRead:
    return ConnectorDaemonStatusRead.model_validate(
        connector_registry.status(kind)[0], from_attributes=True
    )


@router.get("", response_model=list[ConnectorRead])
async def list_connectors(db: AsyncSession = Depends(get_db)) -> list[ConnectorRead]:
    return await ConnectorService(db).list()


@router.get("/status", response_model=list[ConnectorDaemonStatusRead])
async def list_connector_statuses() -> list[ConnectorDaemonStatusRead]:
    return [
        ConnectorDaemonStatusRead.model_validate(status, from_attributes=True)
        for status in connector_registry.status()
    ]


@router.post("", response_model=ConnectorRead)
async def create_connector(
    data: ConnectorCreate, db: AsyncSession = Depends(get_db)
) -> ConnectorRead:
    return await ConnectorService(db).create(data)


@router.patch("/{connector_id}", response_model=ConnectorRead)
async def update_connector(
    connector_id: UUID, data: ConnectorUpdate, db: AsyncSession = Depends(get_db)
) -> ConnectorRead:
    connector = await ConnectorService(db).update(connector_id, data)
    if not connector_registry.has(connector.kind):
        return connector
    if data.enabled is True:
        await connector_registry.start(connector.kind)
    elif data.enabled is False:
        await connector_registry.stop(connector.kind)
    return connector


@router.get("/{kind}/status", response_model=ConnectorDaemonStatusRead)
async def connector_status(kind: str) -> ConnectorDaemonStatusRead:
    return _daemon_status(kind)


@router.post(
    "/gmail/captures",
    response_model=CaptureRead,
    status_code=status.HTTP_201_CREATED,
)
async def ingest_gmail_capture(
    payload: GmailCapture,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> CaptureRead:
    capture, created = await CaptureService(db).ingest(capture_from_gmail(payload))
    if not created:
        response.status_code = status.HTTP_200_OK
    return capture


@router.get("/gmail/drafts/latest", response_model=GmailLatestDraftRead)
async def latest_gmail_draft(db: AsyncSession = Depends(get_db)) -> GmailLatestDraftRead:
    draft = (
        await db.scalars(
            select(Draft)
            .join(Conversation)
            .where(
                Draft.status == "ready",
                or_(Conversation.connector == "gmail", Conversation.thread_kind == "email"),
            )
            .options(selectinload(Draft.variants), selectinload(Draft.conversation))
            .order_by(Draft.updated_at.desc())
        )
    ).first()

    if not draft:
        raise NotFoundError("gmail_draft", "latest")

    selected_variant = next(
        (variant for variant in draft.variants if variant.id == draft.selected_variant_id),
        None,
    )
    text = (selected_variant.body if selected_variant else draft.text).strip()
    if not text:
        raise NotFoundError("gmail_draft", "latest")

    conversation = draft.conversation
    metadata = conversation.meta or {}
    gmail_url = metadata.get("url")
    return GmailLatestDraftRead(
        draft_id=draft.id,
        conversation_id=conversation.id,
        subject=conversation.title,
        text=text,
        gmail_url=gmail_url if isinstance(gmail_url, str) else None,
        updated_at=draft.updated_at.isoformat(),
    )


@router.post("/{kind}/pause", response_model=ConnectorDaemonStatusRead)
async def pause_connector(kind: str) -> ConnectorDaemonStatusRead:
    status = await connector_registry.pause(kind)
    return ConnectorDaemonStatusRead.model_validate(status, from_attributes=True)


@router.post("/{kind}/resume", response_model=ConnectorDaemonStatusRead)
async def resume_connector(kind: str) -> ConnectorDaemonStatusRead:
    status = await connector_registry.resume(kind)
    return ConnectorDaemonStatusRead.model_validate(status, from_attributes=True)


@router.post("/{kind}/sync", response_model=ConnectorDaemonStatusRead)
async def sync_connector(kind: str) -> ConnectorDaemonStatusRead:
    status = await connector_registry.sync_once(kind)
    return ConnectorDaemonStatusRead.model_validate(status, from_attributes=True)


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
    await connector_registry.stop("telegram")
    return status


@router.get("/telegram/auth/status", response_model=TelegramAuthStatus)
async def telegram_status() -> TelegramAuthStatus:
    return await telegram_auth.current_status()
