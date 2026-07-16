from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from draftlet_api.connectors.telegram.sender import TelegramSender
from draftlet_api.core.errors import ConnectorError, NotFoundError
from draftlet_api.database.models import Conversation, Draft, DraftVariant, Message
from draftlet_api.dtos.conversation import (
    ConversationCreate,
    ConversationRead,
    ConversationUpdate,
)
from draftlet_api.dtos.draft import (
    DraftCreate,
    DraftRead,
    DraftTelegramSendRequest,
    DraftTelegramSendResponse,
    DraftUpdate,
    DraftVariantCreate,
    DraftVariantGenerate,
    DraftVariantRead,
    SelectedMessageList,
)
from draftlet_api.dtos.generation import GenerationCreate
from draftlet_api.dtos.message import MessageCreate, MessageRead
from draftlet_api.repositories.setting_repository import SettingRepository
from draftlet_api.services.ollama_client import OllamaClient


def conversation_dto(item: Conversation) -> ConversationRead:
    drafts = item.drafts or []
    latest_actionable_draft = next(
        (draft for draft in drafts if draft.status in {"generating", "ready"}), None
    )
    return ConversationRead(
        id=item.id,
        connector=item.connector,
        title=item.title,
        contact=item.contact,
        participants=item.participants,
        source=item.source,
        external_thread_id=item.external_thread_id,
        thread_kind=item.thread_kind,
        metadata=item.meta,
        latest_message=item.latest_message,
        timestamp=item.latest_message_at,
        captured_at=item.captured_at,
        draft_pending=any(d.status in {"generating", "ready"} for d in drafts),
        needs_follow_up=item.needs_follow_up,
        recently_captured=item.recently_captured,
        draft_ids=[d.id for d in drafts],
        latest_draft_id=latest_actionable_draft.id if latest_actionable_draft else None,
        messages=[message_dto(message) for message in item.messages],
    )


def message_dto(item: Message) -> MessageRead:
    return MessageRead(
        id=item.id,
        kind=item.kind,
        author=item.author,
        timestamp=item.timestamp,
        body=item.body,
        status=item.status,
        source_message_id=item.source_message_id,
        external_message_id=item.external_message_id,
        reply_to_message_id=item.reply_to_message_id,
        reply_to_external_message_id=item.reply_to_external_message_id,
        metadata=item.meta,
    )


def draft_dto(item: Draft) -> DraftRead:
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
        variants=[DraftVariantRead.model_validate(v) for v in item.variants],
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _legacy_telegram_route(conversation: Conversation) -> tuple[int, int | None]:
    source = conversation.source
    if source.startswith("telegram:"):
        route = source.removeprefix("telegram:")
    elif source.startswith("ConnectorKind.TELEGRAM:"):
        route = source.removeprefix("ConnectorKind.TELEGRAM:")
    else:
        raise ConnectorError(
            "telegram_send_unsupported_conversation",
            "This draft is not from a Telegram conversation.",
            status=400,
        )

    chat_id, separator, message_id = route.rpartition(":")
    if not separator:
        try:
            return int(route), None
        except ValueError as error:
            raise ConnectorError(
                "telegram_route_invalid",
                "This Telegram conversation is missing routing metadata.",
                status=400,
            ) from error

    try:
        return int(chat_id), int(message_id)
    except ValueError as error:
        raise ConnectorError(
            "telegram_route_invalid",
            "This Telegram conversation has invalid routing metadata.",
            status=400,
        ) from error


def _telegram_message_id(message: Message) -> int | None:
    raw = message.external_message_id or message.source_message_id
    if raw:
        _chat_id, separator, message_id = raw.rpartition(":")
        if separator:
            try:
                return int(message_id)
            except ValueError:
                pass
    value = message.meta.get("message_id") if message.meta else None
    return int(value) if isinstance(value, int | str) and str(value).isdigit() else None


def _telegram_chat_id(conversation: Conversation) -> int:
    if conversation.external_thread_id:
        try:
            return int(conversation.external_thread_id)
        except ValueError:
            pass
    value = conversation.meta.get("chat_id") if conversation.meta else None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            pass
    chat_id, _message_id = _legacy_telegram_route(conversation)
    return chat_id


class RuntimeService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def conversations(self) -> list[ConversationRead]:
        rows = await self.db.scalars(
            select(Conversation)
            .options(
                selectinload(Conversation.messages), selectinload(Conversation.drafts)
            )
            .order_by(Conversation.latest_message_at.desc())
        )
        return [conversation_dto(row) for row in rows]

    async def conversation(self, conversation_id: UUID) -> Conversation:
        row = (
            await self.db.scalars(
                select(Conversation)
                .where(Conversation.id == conversation_id)
                .options(
                    selectinload(Conversation.messages),
                    selectinload(Conversation.drafts),
                )
            )
        ).first()

        if not row:
            raise NotFoundError("conversation", str(conversation_id))

        return row

    async def create_conversation(self, data: ConversationCreate) -> ConversationRead:
        row = Conversation(**data.model_dump())
        self.db.add(row)
        await self.db.commit()
        return conversation_dto(await self.conversation(row.id))

    async def update_conversation(
        self, conversation_id: UUID, data: ConversationUpdate
    ) -> ConversationRead:
        row = await self.conversation(conversation_id)
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(row, key, value)
        await self.db.commit()
        return conversation_dto(await self.conversation(conversation_id))

    async def add_message(
        self, conversation_id: UUID, data: MessageCreate
    ) -> MessageRead:
        conversation = await self.conversation(conversation_id)
        values = data.model_dump(exclude_none=True)
        values.setdefault("timestamp", datetime.now(UTC))
        message = Message(conversation_id=conversation.id, **values)
        conversation.latest_message, conversation.latest_message_at = (
            message.body,
            message.timestamp,
        )
        self.db.add(message)
        await self.db.commit()
        await self.db.refresh(message)
        return message_dto(message)

    async def drafts(self, conversation_id: UUID | None = None) -> list[DraftRead]:
        query = (
            select(Draft)
            .options(selectinload(Draft.variants))
            .order_by(Draft.updated_at.desc())
        )
        if conversation_id:
            query = query.where(Draft.conversation_id == conversation_id)
        return [draft_dto(row) for row in await self.db.scalars(query)]

    async def draft(self, draft_id: UUID) -> Draft:
        row = (
            await self.db.scalars(
                select(Draft)
                .where(Draft.id == draft_id)
                .options(selectinload(Draft.variants))
            )
        ).first()
        if not row:
            raise NotFoundError("draft", str(draft_id))
        return row

    async def create_draft(self, data: DraftCreate) -> DraftRead:
        await self.conversation(data.conversation_id)
        row = Draft(
            **data.model_dump(exclude={"selected_messages"}),
            selected_messages=data.selected_messages,
        )
        self.db.add(row)
        await self.db.commit()
        return draft_dto(await self.draft(row.id))

    async def update_draft(self, draft_id: UUID, data: DraftUpdate) -> DraftRead:
        row = await self.draft(draft_id)
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(
                row,
                key,
                value,
            )
        await self.db.commit()
        return draft_dto(await self.draft(draft_id))

    async def add_variant(
        self, draft_id: UUID, data: DraftVariantCreate
    ) -> DraftVariantRead:
        draft = await self.draft(draft_id)
        variant = DraftVariant(draft_id=draft.id, **data.model_dump())
        self.db.add(variant)
        await self.db.commit()
        await self.db.refresh(variant)
        return DraftVariantRead.model_validate(variant)

    async def generate_variant(
        self, draft_id: UUID, data: DraftVariantGenerate
    ) -> DraftVariantRead:
        draft = await self.draft(draft_id)
        conversation = await self.conversation(draft.conversation_id)
        text, provider, _instruction = await self._generate_reply(
            conversation,
            GenerationCreate(
                conversation_id=conversation.id,
                instruction=data.instruction,
                tone=data.tone,
                length=data.length,
                coverage=data.coverage,
                model_override=data.model_override,
            ),
        )
        variant = await self.add_variant(
            draft.id,
            DraftVariantCreate(
                title=f"{data.tone} {data.length.lower()} · {data.coverage.lower()}",
                detail=provider,
                body=text,
            ),
        )
        draft.selected_variant_id = variant.id
        await self.db.commit()
        return variant

    async def accept(self, draft_id: UUID) -> DraftRead:
        draft = await self.draft(draft_id)
        draft.status = "accepted"
        await self.add_message(
            draft.conversation_id,
            MessageCreate(
                kind="accepted",
                author="Draftlet",
                body=draft.text,
                status="Accepted and inserted",
            ),
        )
        await self.db.commit()
        return draft_dto(await self.draft(draft.id))

    async def send_telegram(
        self,
        draft_id: UUID,
        data: DraftTelegramSendRequest,
    ) -> DraftTelegramSendResponse:
        draft = await self.draft(draft_id)
        conversation = await self.conversation(draft.conversation_id)
        body = (data.body if data.body is not None else draft.text).strip()
        if not body:
            raise ConnectorError(
                "telegram_send_empty_body",
                "Draft text is empty.",
                status=400,
            )

        chat_id = _telegram_chat_id(conversation)
        reply_target = await self._telegram_reply_target(draft, conversation)
        legacy_chat_id, legacy_message_id = _legacy_telegram_route(conversation)
        if legacy_chat_id != chat_id:
            legacy_message_id = None
        reply_to = (
            _telegram_message_id(reply_target)
            if reply_target and data.reply_to_original
            else None
        )
        reply_to = reply_to or (legacy_message_id if data.reply_to_original else None)
        sent = await TelegramSender().send_message(chat_id, body, reply_to=reply_to)

        if data.mark_sent:
            draft.text = body
            draft.status = "sent"
            draft.send_mode = "reply" if reply_to else "new_message"

        message = Message(
            conversation_id=conversation.id,
            kind="outgoing",
            author="You",
            body=body,
            timestamp=sent.date
            if isinstance(sent.date, datetime)
            else datetime.now(UTC),
            status="Sent via Telegram",
            source_message_id=f"{chat_id}:{sent.id}",
            external_message_id=f"{chat_id}:{sent.id}",
            reply_to_message_id=reply_target.id if reply_target and reply_to else None,
            reply_to_external_message_id=(
                reply_target.external_message_id if reply_target and reply_to else None
            ),
            meta={
                "chat_id": chat_id,
                "message_id": sent.id,
                "reply_to_msg_id": reply_to,
            },
        )
        conversation.latest_message = body
        conversation.latest_message_at = message.timestamp
        self.db.add(message)
        await self.db.commit()
        await self.db.refresh(message)

        return DraftTelegramSendResponse(
            draft=draft_dto(await self.draft(draft.id)),
            message=message_dto(message),
            telegram_message_id=str(sent.id),
            reply_to_message_id=reply_to if not sent.reply_fallback else None,
            reply_fallback=sent.reply_fallback,
        )

    async def _telegram_reply_target(
        self,
        draft: Draft,
        conversation: Conversation,
    ) -> Message | None:
        if draft.reply_target_message_id:
            target = (
                await self.db.scalars(
                    select(Message).where(Message.id == draft.reply_target_message_id)
                )
            ).first()
            if target:
                return target
        return (
            await self.db.scalars(
                select(Message)
                .where(
                    Message.conversation_id == conversation.id,
                    Message.kind == "incoming",
                )
                .order_by(Message.timestamp.desc())
            )
        ).first()

    async def generate(self, data: GenerationCreate) -> DraftRead:
        conversation = await self.conversation(data.conversation_id)
        text, provider, instruction = await self._generate_reply(conversation, data)
        row = Draft(
            conversation_id=conversation.id,
            status="ready",
            title=f"Reply to {conversation.title}",
            provider=provider,
            instruction=instruction,
            text=text,
            reply_target_message_id=self._latest_incoming_message_id(conversation),
            send_mode="reply",
            selected_messages=[
                {"author": m.author, "detail": m.body}
                for m in conversation.messages[-5:]
            ],
            references=[conversation.participants] if conversation.participants else [],
        )
        self.db.add(row)
        await self.db.commit()
        return draft_dto(await self.draft(row.id))

    def _latest_incoming_message_id(self, conversation: Conversation) -> UUID | None:
        incoming = [
            message for message in conversation.messages if message.kind == "incoming"
        ]
        return incoming[-1].id if incoming else None

    async def _generate_reply(
        self, conversation: Conversation, data: GenerationCreate
    ) -> tuple[str, str, str]:
        ollama = OllamaClient()
        model_setting = await SettingRepository(self.db).get("ollama_default_model")
        model = data.model_override or (
            model_setting.value
            if model_setting and isinstance(model_setting.value, str)
            else ollama.settings.ollama_default_model
        )
        context = "\n".join(f"{m.author}: {m.body}" for m in conversation.messages)
        instruction = (
            data.instruction
            or f"Write a {data.tone.lower()} reply. {data.length} length. {data.coverage}."
        )
        text = await ollama.chat(
            [
                {
                    "role": "system",
                    "content": "Write a helpful reply. Return only the reply.",
                },
                {
                    "role": "user",
                    "content": f"Conversation:\n{context}\n\nInstruction: {instruction}",
                },
            ],
            model,
        )
        return text, f"ollama:{model}", instruction
