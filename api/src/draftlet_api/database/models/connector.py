from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, JSON, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from draftlet_api.database.base import Base


class Connector(Base):
    __tablename__ = "connectors"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    kind: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    config: Mapped[dict[str, object]] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
