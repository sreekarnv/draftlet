import logging
from datetime import UTC, datetime

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.core.enums import CaptureStatus
from draftlet_api.database.models import Capture, Conversation, Message
from draftlet_api.dtos.capture import CaptureCreate, CaptureRead
from draftlet_api.repositories.capture_repository import CaptureRepository

logger = logging.getLogger(__name__)


class CaptureService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repository = CaptureRepository(db)

    async def list(self, limit: int = 50) -> list[CaptureRead]:
        items: list[CaptureRead] = []
        for item in await self.repository.list(limit):
            try:
                items.append(CaptureRead.model_validate(item))
            except ValidationError as error:
                logger.warning(
                    "Skipping capture %s due to validation error: %s",
                    getattr(item, "id", None),
                    error,
                )
        return items

    async def ingest(self, payload: CaptureCreate) -> tuple[CaptureRead, bool]:
        existing = await self.repository.get_by_dedupe(
            payload.connector_kind,
            payload.source_message_id,
            payload.external_message_id,
        )
        if existing:
            return CaptureRead.model_validate(existing), False

        timestamp = payload.timestamp or datetime.now(UTC)
        captured_at = datetime.now(UTC)
        connector_kind = payload.connector_kind.value
        external_message_id = payload.external_message_id or payload.source_message_id
        conversation = await self._conversation_for_capture(
            payload,
            connector_kind,
            timestamp,
            captured_at,
        )
        reply_to_message_id = await self._reply_to_message_id(
            payload.connector_kind.value,
            payload.reply_to_external_message_id,
        )
        message = Message(
            conversation=conversation,
            kind="incoming",
            author=payload.author,
            body=payload.body,
            timestamp=timestamp,
            source_message_id=payload.source_message_id,
            external_message_id=external_message_id,
            reply_to_external_message_id=payload.reply_to_external_message_id,
            reply_to_message_id=reply_to_message_id,
            meta=payload.metadata,
        )
        conversation.latest_message = payload.body
        conversation.latest_message_at = timestamp
        conversation.recently_captured = True
        capture = Capture(
            connector_kind=connector_kind,
            source_message_id=payload.source_message_id,
            external_thread_id=payload.external_thread_id,
            external_message_id=external_message_id,
            conversation=conversation,
            message=message,
            status=CaptureStatus.CAPTURED.value,
            captured_at=captured_at,
        )

        try:
            return CaptureRead.model_validate(await self.repository.add(capture)), True
        except IntegrityError:
            await self.db.rollback()
            existing = await self.repository.get_by_dedupe(
                payload.connector_kind,
                payload.source_message_id,
                payload.external_message_id,
            )
            if existing:
                return CaptureRead.model_validate(existing), False
            raise

    async def _conversation_for_capture(
        self,
        payload: CaptureCreate,
        connector_kind: str,
        timestamp: datetime,
        captured_at: datetime,
    ) -> Conversation:
        if payload.external_thread_id:
            existing = (
                await self.db.scalars(
                    select(Conversation).where(
                        Conversation.connector == connector_kind,
                        Conversation.external_thread_id == payload.external_thread_id,
                    )
                )
            ).first()
            if existing:
                return existing

        return Conversation(
            connector=connector_kind,
            title=payload.title,
            contact=payload.contact,
            participants=payload.participants,
            source=(
                f"{connector_kind}:{payload.external_thread_id}"
                if payload.external_thread_id
                else f"{connector_kind}:{payload.source_message_id}"
            ),
            external_thread_id=payload.external_thread_id,
            thread_kind="chat" if connector_kind == "telegram" else None,
            meta=payload.metadata,
            latest_message=payload.body,
            latest_message_at=timestamp,
            captured_at=captured_at,
            recently_captured=True,
        )

    async def _reply_to_message_id(
        self,
        connector_kind: str,
        reply_to_external_message_id: str | None,
    ):
        if not reply_to_external_message_id:
            return None
        message = (
            await self.db.scalars(
                select(Message).where(
                    Message.external_message_id == reply_to_external_message_id,
                    Message.conversation.has(Conversation.connector == connector_kind),
                )
            )
        ).first()
        return message.id if message else None
