from datetime import datetime

from pydantic import BaseModel, Field

from draftlet_api.connectors.email.mapper import capture_from_email
from draftlet_api.connectors.email.models import EmailCapture
from draftlet_api.core.enums import ConnectorKind
from draftlet_api.dtos.capture import CaptureCreate


class GmailCapture(BaseModel):
    gmail_message_id: str = Field(min_length=1, max_length=255)
    gmail_thread_id: str | None = Field(default=None, max_length=255)
    reply_to_gmail_message_id: str | None = Field(default=None, max_length=255)
    subject: str = "Untitled email"
    sender: str = "Unknown"
    to: list[str] = Field(default_factory=list)
    cc: list[str] = Field(default_factory=list)
    bcc: list[str] = Field(default_factory=list)
    body: str
    body_format: str = "plain"
    gmail_url: str | None = None
    timestamp: datetime | None = None
    metadata: dict[str, object] = Field(default_factory=dict)


def capture_from_gmail(gmail: GmailCapture) -> CaptureCreate:
    metadata = {
        "gmail_thread_id": gmail.gmail_thread_id,
        "gmail_message_id": gmail.gmail_message_id,
        **gmail.metadata,
    }
    email = EmailCapture(
        provider="gmail",
        provider_message_id=gmail.gmail_message_id,
        provider_thread_id=gmail.gmail_thread_id,
        reply_to_provider_message_id=gmail.reply_to_gmail_message_id,
        subject=gmail.subject,
        sender=gmail.sender,
        to=gmail.to,
        cc=gmail.cc,
        bcc=gmail.bcc,
        body=gmail.body,
        body_format=gmail.body_format,
        url=gmail.gmail_url,
        timestamp=gmail.timestamp,
        metadata=metadata,
    )
    return capture_from_email(email, ConnectorKind.GMAIL)
