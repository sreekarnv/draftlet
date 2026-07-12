from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.core.errors import NotFoundError
from draftlet_api.database.models import Conversation, Message
from draftlet_api.dtos.conversation import (
    ConversationCreate,
    ConversationRead,
    ConversationUpdate,
)
from draftlet_api.dtos.message import MessageCreate, MessageRead
from draftlet_api.repositories.conversation_repository import ConversationRepository


def conversation_read(item: Conversation) -> ConversationRead:
    drafts = item.drafts or []

    return ConversationRead(
        id=item.id,
        connector=item.connector,
        title=item.title,
        contact=item.contact,
        participants=item.participants,
        source=item.source,
        latest_message=item.latest_message,
        timestamp=item.latest_message_at,
        captured_at=item.captured_at,
        draft_pending=any(draft.status in {"generating", "ready"} for draft in drafts),
        needs_follow_up=item.needs_follow_up,
        recently_captured=item.recently_captured,
        draft_ids=[draft.id for draft in drafts],
        latest_draft_id=drafts[0].id if drafts else None,
        messages=[MessageRead.model_validate(message) for message in item.messages],
    )


class ConversationService:
    def __init__(self, db: AsyncSession):
        self.repo = ConversationRepository(db)

    async def list(self, limit: int) -> list[ConversationRead]:
        return [conversation_read(item) for item in await self.repo.list(limit)]

    async def get(self, conversation_id: UUID) -> ConversationRead:
        item = await self.repo.get(conversation_id)
        if not item:
            raise NotFoundError("conversation", str(conversation_id))
        return conversation_read(item)

    async def create(self, payload: ConversationCreate) -> ConversationRead:
        item = Conversation(**payload.model_dump())
        return conversation_read(await self.repo.add(item))

    async def update(
        self, conversation_id: UUID, payload: ConversationUpdate
    ) -> ConversationRead:
        item = await self.repo.get(conversation_id)
        if not item:
            raise NotFoundError("conversation", str(conversation_id))
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(item, key, value)
        return conversation_read(await self.repo.add(item))

    async def add_message(
        self, conversation_id: UUID, payload: MessageCreate
    ) -> MessageRead:
        conversation = await self.repo.get(conversation_id)
        if not conversation:
            raise NotFoundError("conversation", str(conversation_id))
        values = payload.model_dump(exclude_none=True)
        values.setdefault("timestamp", datetime.now(UTC))
        message = await self.repo.add_message(
            conversation, Message(conversation_id=conversation.id, **values)
        )
        return MessageRead.model_validate(message)
