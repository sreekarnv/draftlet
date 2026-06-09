from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.workspace import WorkspaceSession


class ConversationThread(Base):
    __tablename__ = "conversation_threads"

    thread_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("workspace_sessions.session_id", ondelete="CASCADE"), index=True)
    selected_text: Mapped[str] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(Text)
    source_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    page_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    session: Mapped["WorkspaceSession"] = relationship(back_populates="threads")
    turns: Mapped[list["Turn"]] = relationship(
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="Turn.created_at",
    )


class Turn(Base):
    __tablename__ = "turns"

    turn_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    thread_id: Mapped[str] = mapped_column(ForeignKey("conversation_threads.thread_id", ondelete="CASCADE"), index=True)
    instruction: Mapped[str] = mapped_column(Text)
    selected_text: Mapped[str] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(Text)
    source_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    page_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    tone: Mapped[str] = mapped_column(String(80))
    generation_status: Mapped[str] = mapped_column(String(40), default="queued")
    generation_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    generation_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    generation_failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    generation_cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    generation_error_code: Mapped[str | None] = mapped_column(String(120), nullable=True)
    generation_error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    thread: Mapped["ConversationThread"] = relationship(back_populates="turns")
    variants: Mapped[list["DraftVariant"]] = relationship(
        back_populates="turn",
        cascade="all, delete-orphan",
        order_by="DraftVariant.rank",
    )
    generation_runs: Mapped[list["GenerationRun"]] = relationship(
        back_populates="turn",
        cascade="all, delete-orphan",
        order_by="GenerationRun.claimed_at",
    )


class DraftVariant(Base):
    __tablename__ = "draft_variants"
    __table_args__ = (UniqueConstraint("turn_id", "rank", name="uq_draft_variants_turn_rank"),)

    variant_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    turn_id: Mapped[str] = mapped_column(ForeignKey("turns.turn_id", ondelete="CASCADE"), index=True)
    tone: Mapped[str] = mapped_column(String(80))
    length: Mapped[str | None] = mapped_column(String(80), nullable=True)
    content: Mapped[str] = mapped_column(Text)
    rank: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(40), default="generated")
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    turn: Mapped["Turn"] = relationship(back_populates="variants")


class GenerationRun(Base):
    __tablename__ = "generation_runs"

    run_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("workspace_sessions.session_id", ondelete="CASCADE"), index=True)
    thread_id: Mapped[str] = mapped_column(ForeignKey("conversation_threads.thread_id", ondelete="CASCADE"), index=True)
    turn_id: Mapped[str] = mapped_column(ForeignKey("turns.turn_id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(40), default="active", index=True)
    lease_owner: Mapped[str] = mapped_column(String(120))
    claimed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    interrupted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(120), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    turn: Mapped["Turn"] = relationship(back_populates="generation_runs")
