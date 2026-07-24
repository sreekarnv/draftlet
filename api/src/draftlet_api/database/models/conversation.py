from typing import TYPE_CHECKING
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from draftlet_api.database.base import Base

if TYPE_CHECKING:
    from draftlet_api.database.models.draft import Draft
    from draftlet_api.database.models.message import Message

def utcnow() -> datetime:
    return datetime.now(UTC)


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    connector: Mapped[str] = mapped_column(String(64), index=True)
    title: Mapped[str] = mapped_column(String(500))
    contact: Mapped[str] = mapped_column(String(500))
    participants: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(500), default="")
    external_thread_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    thread_kind: Mapped[str | None] = mapped_column(String(64), nullable=True)
    meta: Mapped[dict[str, object]] = mapped_column("metadata", JSON, default=dict)
    latest_message: Mapped[str] = mapped_column(Text, default="")
    latest_message_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    needs_follow_up: Mapped[bool] = mapped_column(Boolean, default=False)
    recently_captured: Mapped[bool] = mapped_column(Boolean, default=True)
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.timestamp",
    )
    drafts: Mapped[list["Draft"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Draft.created_at.desc()",
    )
