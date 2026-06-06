from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.generation import Generation


class Reply(Base):
    __tablename__ = "replies"
    __table_args__ = (UniqueConstraint("generation_id", "reply_index", name="uq_replies_generation_index"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    generation_id: Mapped[int] = mapped_column(ForeignKey("generations.id", ondelete="CASCADE"), index=True)
    reply_index: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    generation: Mapped["Generation"] = relationship(back_populates="replies")
