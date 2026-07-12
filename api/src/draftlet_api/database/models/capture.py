from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from draftlet_api.core.enums import CaptureStatus
from draftlet_api.database.base import Base

if TYPE_CHECKING:
    from draftlet_api.database.models.conversation import Conversation
    from draftlet_api.database.models.message import Message


class Capture(Base):
    __tablename__ = "captures"
    __table_args__ = (
        UniqueConstraint(
            "connector_kind",
            "source_message_id",
            name="uq_captures_kind_source",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    connector_kind: Mapped[str] = mapped_column(String(64), index=True)
    source_message_id: Mapped[str] = mapped_column(String(255), index=True)
    conversation_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True
    )
    message_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("messages.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(32), default=CaptureStatus.CAPTURED.value
    )
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    conversation: Mapped["Conversation | None"] = relationship()
    message: Mapped["Message | None"] = relationship()
