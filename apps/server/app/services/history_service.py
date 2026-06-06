from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Generation


def list_recent_generations(session: Session, limit: int = 20) -> list[Generation]:
    statement = (
        select(Generation)
        .options(selectinload(Generation.replies))
        .order_by(Generation.created_at.desc(), Generation.id.desc())
        .limit(limit)
    )
    return list(session.scalars(statement).all())
