from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from draftlet_api.database.base import Base

if TYPE_CHECKING:
    from draftlet_api.database.models.conversation import Conversation
    from draftlet_api.database.models.draft_variant import DraftVariant



class Draft(Base):
    __tablename__ = "drafts"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(32), default="ready", index=True)
    title: Mapped[str] = mapped_column(String(500))
    provider: Mapped[str] = mapped_column(String(255))
    instruction: Mapped[str] = mapped_column(Text, default="")
    text: Mapped[str] = mapped_column(Text, default="")
    selected_variant_id: Mapped[UUID | None] = mapped_column(nullable=True)
    selected_messages: Mapped[list[dict[str, str]]] = mapped_column(JSON, default=list)
    references: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    conversation: Mapped["Conversation"] = relationship(back_populates="drafts")
    variants: Mapped[list["DraftVariant"]] = relationship(
        back_populates="draft", cascade="all, delete-orphan"
    )
