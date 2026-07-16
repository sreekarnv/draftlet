from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from draftlet_api.database.models import Conversation, Message


class ConversationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, limit: int = 50) -> list[Conversation]:
        result = await self.db.scalars(
            select(Conversation)
            .options(
                selectinload(Conversation.messages), selectinload(Conversation.drafts)
            )
            .order_by(Conversation.latest_message_at.desc())
            .limit(limit)
        )
        return list(result)

    async def get(self, conversation_id: UUID) -> Conversation | None:
        result = await self.db.scalars(
            select(Conversation)
            .where(Conversation.id == conversation_id)
            .options(
                selectinload(Conversation.messages), selectinload(Conversation.drafts)
            )
        )
        return result.first()

    async def add(self, conversation: Conversation) -> Conversation:
        self.db.add(conversation)
        await self.db.commit()
        return await self.get(conversation.id) or conversation

    async def add_message(
        self, conversation: Conversation, message: Message
    ) -> Message:
        self.db.add(message)
        conversation.latest_message = message.body
        conversation.latest_message_at = message.timestamp
        await self.db.commit()
        await self.db.refresh(message)
        return message
