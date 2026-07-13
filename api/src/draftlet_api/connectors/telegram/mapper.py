from telethon.tl.custom.message import Message

from draftlet_api.core.enums import ConnectorKind
from draftlet_api.dtos.capture import CaptureCreate


def _name(value: object, fallback: str) -> str:
    for attr in ("title", "username", "first_name", "last_name"):
        name = getattr(value, attr, None)
        if name:
            return str(name)
    return fallback


async def capture_from_message(message: Message) -> CaptureCreate:
    chat = await message.get_chat()
    sender = await message.get_sender()
    chat_id = getattr(message, "chat_id", None) or getattr(chat, "id", "unknown")
    sender_id = getattr(sender, "id", "unknown")
    body = message.raw_text or "<media>"
    return CaptureCreate(
        connector_kind=ConnectorKind.TELEGRAM,
        source_message_id=f"{chat_id}:{message.id}",
        title=_name(chat, f"Telegram chat {chat_id}"),
        contact=_name(sender, str(sender_id)),
        participants=_name(chat, "Telegram"),
        body=body,
        author=_name(sender, "Unknown"),
        timestamp=message.date,
    )
