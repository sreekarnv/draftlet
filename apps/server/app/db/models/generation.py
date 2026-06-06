from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.reply import Reply


class Generation(Base):
    __tablename__ = "generations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    selected_text: Mapped[str] = mapped_column(Text)
    tone: Mapped[str] = mapped_column(String(80))
    model: Mapped[str] = mapped_column(String(120))
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="started")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    replies: Mapped[list["Reply"]] = relationship(
        back_populates="generation",
        cascade="all, delete-orphan",
        order_by="Reply.reply_index",
    )
