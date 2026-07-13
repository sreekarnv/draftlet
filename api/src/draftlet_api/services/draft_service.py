from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from draftlet_api.core.errors import NotFoundError
from draftlet_api.database.models import Draft, DraftVariant, Message
from draftlet_api.dtos.draft import (
    DraftCreate,
    DraftRead,
    DraftUpdate,
    DraftVariantCreate,
    DraftVariantRead,
    SelectedMessageList,
)
from draftlet_api.repositories.conversation_repository import ConversationRepository
from draftlet_api.repositories.draft_repository import DraftRepository


def draft_read(item: Draft) -> DraftRead:
    selected_messages = SelectedMessageList.model_validate(
        {"items": item.selected_messages}
    )

    return DraftRead(
        id=item.id,
        conversation_id=item.conversation_id,
        status=item.status,
        title=item.title,
        provider=item.provider,
        instruction=item.instruction,
        text=item.text,
        selected_variant_id=item.selected_variant_id,
        reply_target_message_id=item.reply_target_message_id,
        send_mode=item.send_mode,
        selected_messages=selected_messages.items,
        references=item.references,
        variants=[
            DraftVariantRead.model_validate(variant) for variant in item.variants
        ],
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


class DraftService:
    def __init__(self, db: AsyncSession):
        self.repo = DraftRepository(db)
        self.conversations = ConversationRepository(db)
        self.db = db

    async def list(self, conversation_id: UUID | None) -> list[DraftRead]:
        return [draft_read(item) for item in await self.repo.list(conversation_id)]

    async def get(self, draft_id: UUID) -> DraftRead:
        item = await self.repo.get(draft_id)
        if not item:
            raise NotFoundError("draft", str(draft_id))
        return draft_read(item)

    async def create(self, payload: DraftCreate) -> DraftRead:
        if not await self.conversations.get(payload.conversation_id):
            raise NotFoundError("conversation", str(payload.conversation_id))
        item = Draft(**payload.model_dump())
        return draft_read(await self.repo.save(item))

    async def update(self, draft_id: UUID, payload: DraftUpdate) -> DraftRead:
        item = await self.repo.get(draft_id)
        if not item:
            raise NotFoundError("draft", str(draft_id))
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(item, key, value)
        return draft_read(await self.repo.save(item))

    async def add_variant(
        self, draft_id: UUID, payload: DraftVariantCreate
    ) -> DraftVariantRead:
        draft = await self.repo.get(draft_id)
        if not draft:
            raise NotFoundError("draft", str(draft_id))
        return DraftVariantRead.model_validate(
            await self.repo.add_variant(
                draft, DraftVariant(draft_id=draft.id, **payload.model_dump())
            )
        )

    async def accept(self, draft_id: UUID) -> DraftRead:
        draft = await self.repo.get(draft_id)
        if not draft:
            raise NotFoundError("draft", str(draft_id))
        draft.status = "accepted"
        conversation = await self.conversations.get(draft.conversation_id)
        if conversation:
            message = Message(
                conversation_id=conversation.id,
                kind="accepted",
                author="Draftlet",
                body=draft.text,
                status="Accepted and inserted",
                timestamp=datetime.now(UTC),
            )
            await self.conversations.add_message(conversation, message)
        return draft_read(await self.repo.save(draft))

    async def mark_sent(self, draft_id: UUID) -> DraftRead:
        return await self.update(draft_id, DraftUpdate(status="sent"))
