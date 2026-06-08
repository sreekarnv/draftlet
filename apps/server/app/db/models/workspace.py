from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.conversation import ConversationThread


class WorkspaceSession(Base):
    __tablename__ = "workspace_sessions"

    session_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    tab_id: Mapped[int | None] = mapped_column(nullable=True)
    window_id: Mapped[int | None] = mapped_column(nullable=True)
    page_url: Mapped[str] = mapped_column(Text)
    page_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    selected_text: Mapped[str] = mapped_column(Text)
    source_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="active")
    active_thread_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    threads: Mapped[list["ConversationThread"]] = relationship(back_populates="session")
