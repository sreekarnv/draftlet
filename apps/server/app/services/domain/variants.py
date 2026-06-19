from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import DraftVariant, Turn
from app.schemas.domain import ConversationThreadSnapshot, DraftVariantCreate, DraftVariantStateUpdate


def create_or_update_variant(session: Session, payload: DraftVariantCreate) -> DraftVariant:
    existing = session.get(DraftVariant, payload.variant_id)

    if existing:
        existing.turn_id = payload.turn_id
        existing.tone = payload.tone
        existing.length = payload.length
        existing.content = payload.content
        existing.rank = payload.rank
        existing.status = payload.status
        existing.is_current = payload.is_current
        variant = existing
    else:
        variant = DraftVariant(
            variant_id=payload.variant_id,
            turn_id=payload.turn_id,
            tone=payload.tone,
            length=payload.length,
            content=payload.content,
            rank=payload.rank,
            status=payload.status,
            is_current=payload.is_current,
        )

    session.add(variant)
    session.commit()
    session.refresh(variant)
    return variant


def update_variant_state(
    session: Session,
    variant_id: str,
    payload: DraftVariantStateUpdate,
) -> ConversationThreadSnapshot | None:
    variant = session.get(DraftVariant, variant_id)

    if not variant:
        return None

    turn = session.get(Turn, variant.turn_id)

    if not turn:
        return None

    thread_id = turn.thread_id

    if payload.is_current:
        # Current and accepted are intentionally bounded to one variant per thread for this phase.
        for thread_variant in variants_for_thread(session, thread_id):
            thread_variant.is_current = thread_variant.variant_id == variant_id
            session.add(thread_variant)

    if payload.status == "accepted":
        for thread_variant in variants_for_thread(session, thread_id):
            thread_variant.status = "accepted" if thread_variant.variant_id == variant_id else "generated"
            thread_variant.is_current = thread_variant.variant_id == variant_id
            session.add(thread_variant)
    elif payload.status:
        variant.status = payload.status
        session.add(variant)

    session.commit()
    from app.services.domain.snapshots import get_thread_snapshot

    return get_thread_snapshot(session, thread_id)


def variants_for_thread(session: Session, thread_id: str) -> list[DraftVariant]:
    statement = (
        select(DraftVariant)
        .join(Turn, DraftVariant.turn_id == Turn.turn_id)
        .where(Turn.thread_id == thread_id)
    )
    return list(session.scalars(statement))


def variants_for_turn(session: Session, turn_id: str) -> list[DraftVariant]:
    statement = select(DraftVariant).where(DraftVariant.turn_id == turn_id).order_by(DraftVariant.rank)
    return list(session.scalars(statement))
