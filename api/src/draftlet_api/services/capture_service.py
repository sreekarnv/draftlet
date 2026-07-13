import logging
from datetime import UTC, datetime

from pydantic import ValidationError
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
        )
        if existing:
            return CaptureRead.model_validate(existing), False

        timestamp = payload.timestamp or datetime.now(UTC)
        captured_at = datetime.now(UTC)
        connector_kind = payload.connector_kind.value
        conversation = Conversation(
            connector=connector_kind,
            title=payload.title,
            contact=payload.contact,
            participants=payload.participants,
            source=f"{connector_kind}:{payload.source_message_id}",
            latest_message=payload.body,
            latest_message_at=timestamp,
            captured_at=captured_at,
            recently_captured=True,
        )
        message = Message(
            conversation=conversation,
            kind="incoming",
            author=payload.author,
            body=payload.body,
            timestamp=timestamp,
            source_message_id=payload.source_message_id,
        )
        capture = Capture(
            connector_kind=connector_kind,
            source_message_id=payload.source_message_id,
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
            )
            if existing:
                return CaptureRead.model_validate(existing), False
            raise
