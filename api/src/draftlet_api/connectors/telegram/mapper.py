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
    message_id = getattr(message, "id", None)
    reply_to_msg_id = getattr(message, "reply_to_msg_id", None)
    external_thread_id = str(chat_id)
    external_message_id = f"{chat_id}:{message_id}"
    body = message.raw_text or "<media>"
    return CaptureCreate(
        connector_kind=ConnectorKind.TELEGRAM,
        source_message_id=external_message_id,
        external_thread_id=external_thread_id,
        external_message_id=external_message_id,
        reply_to_external_message_id=(
            f"{chat_id}:{reply_to_msg_id}" if reply_to_msg_id else None
        ),
        metadata={
            "chat_id": chat_id,
            "message_id": message_id,
            "reply_to_msg_id": reply_to_msg_id,
            "sender_id": sender_id,
        },
        title=_name(chat, f"Telegram chat {chat_id}"),
        contact=_name(sender, str(sender_id)),
        participants=_name(chat, "Telegram"),
        body=body,
        author=_name(sender, "Unknown"),
        timestamp=message.date,
    )
