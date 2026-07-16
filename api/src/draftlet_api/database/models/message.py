from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from draftlet_api.database.base import Base

if TYPE_CHECKING:
    from draftlet_api.database.models.conversation import Conversation


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(32))
    author: Mapped[str] = mapped_column(String(500))
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_message_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    external_message_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    reply_to_message_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("messages.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reply_to_external_message_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    meta: Mapped[dict[str, object]] = mapped_column("metadata", JSON, default=dict)
    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
