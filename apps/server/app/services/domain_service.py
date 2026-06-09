from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import ConversationThread, DraftVariant, Turn, WorkspaceSession
from app.schemas.domain import (
    ConversationThreadCreate,
    ConversationThreadSnapshot,
    DomainHistoryItem,
    DraftVariantCreate,
    DraftVariantStateUpdate,
    SourceSnapshot,
    TurnCreate,
    WorkspaceSessionSnapshot,
    WorkspaceSessionUpsert,
)


def upsert_workspace_session(session: Session, payload: WorkspaceSessionUpsert) -> WorkspaceSession:
    existing = session.get(WorkspaceSession, payload.session_id)

    if existing:
        existing.tab_id = payload.tab_id
        existing.window_id = payload.window_id
        existing.page_url = payload.page_url
        existing.page_title = payload.page_title
        existing.selected_text = payload.selected_text
        existing.source_domain = payload.source_domain
        existing.status = payload.status
        existing.active_thread_id = payload.active_thread_id
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing

    workspace = WorkspaceSession(
        session_id=payload.session_id,
        tab_id=payload.tab_id,
        window_id=payload.window_id,
        page_url=payload.page_url,
        page_title=payload.page_title,
        selected_text=payload.selected_text,
        source_domain=payload.source_domain,
        status=payload.status,
        active_thread_id=payload.active_thread_id,
    )
    session.add(workspace)
    session.commit()
    session.refresh(workspace)
    return workspace


def create_or_update_thread(session: Session, payload: ConversationThreadCreate) -> ConversationThread:
    ensure_workspace_session_exists(session, payload.session_id, payload.source)
    existing = session.get(ConversationThread, payload.thread_id)

    if existing:
        existing.session_id = payload.session_id
        existing.selected_text = payload.source.selected_text
        existing.source_url = payload.source.source_url
        existing.source_domain = payload.source.source_domain
        existing.page_title = payload.source.page_title
        existing.status = payload.status
        thread = existing
    else:
        thread = ConversationThread(
            thread_id=payload.thread_id,
            session_id=payload.session_id,
            selected_text=payload.source.selected_text,
            source_url=payload.source.source_url,
            source_domain=payload.source.source_domain,
            page_title=payload.source.page_title,
            status=payload.status,
        )

    workspace = session.get(WorkspaceSession, payload.session_id)
    if workspace:
        workspace.active_thread_id = payload.thread_id
        session.add(workspace)

    session.add(thread)
    session.commit()
    session.refresh(thread)
    return thread


def create_or_update_turn(session: Session, payload: TurnCreate) -> Turn:
    existing = session.get(Turn, payload.turn_id)

    if existing:
        existing.thread_id = payload.thread_id
        existing.instruction = payload.instruction
        existing.selected_text = payload.source.selected_text
        existing.source_url = payload.source.source_url
        existing.source_domain = payload.source.source_domain
        existing.page_title = payload.source.page_title
        existing.tone = payload.tone
        existing.generation_status = payload.generation_status
        turn = existing
    else:
        turn = Turn(
            turn_id=payload.turn_id,
            thread_id=payload.thread_id,
            instruction=payload.instruction,
            selected_text=payload.source.selected_text,
            source_url=payload.source.source_url,
            source_domain=payload.source.source_domain,
            page_title=payload.source.page_title,
            tone=payload.tone,
            generation_status=payload.generation_status,
        )

    session.add(turn)
    session.commit()
    session.refresh(turn)
    return turn


def update_turn_status(session: Session, turn_id: str, status: str) -> Turn | None:
    turn = session.get(Turn, turn_id)

    if not turn:
        return None

    turn.generation_status = status
    session.add(turn)
    session.commit()
    session.refresh(turn)
    return turn


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
        existing.legacy_reply_id = payload.legacy_reply_id
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
            legacy_reply_id=payload.legacy_reply_id,
        )

    session.add(variant)
    session.commit()
    session.refresh(variant)
    return variant


def update_variant_state(session: Session, variant_id: str, payload: DraftVariantStateUpdate) -> ConversationThreadSnapshot | None:
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
    return get_thread_snapshot(session, thread_id)


def get_session_snapshot(session: Session, session_id: str) -> WorkspaceSessionSnapshot | None:
    workspace = session.get(WorkspaceSession, session_id)

    if not workspace:
        return None

    thread_snapshot = get_thread_snapshot(session, workspace.active_thread_id) if workspace.active_thread_id else None
    return WorkspaceSessionSnapshot(session=workspace, thread=thread_snapshot)


def get_thread_snapshot(session: Session, thread_id: str | None) -> ConversationThreadSnapshot | None:
    if not thread_id:
        return None

    statement = (
        select(ConversationThread)
        .where(ConversationThread.thread_id == thread_id)
        .options(selectinload(ConversationThread.turns).selectinload(Turn.variants))
    )
    thread = session.scalar(statement)

    if not thread:
        return None

    turns = list(thread.turns)
    variants = [variant for turn in turns for variant in turn.variants]
    return ConversationThreadSnapshot(thread=thread, turns=turns, variants=variants)


def list_recent_domain_history(session: Session, limit: int = 20) -> list[DomainHistoryItem]:
    statement = select(ConversationThread).options(
        selectinload(ConversationThread.session),
        selectinload(ConversationThread.turns).selectinload(Turn.variants),
    )
    threads = sorted(
        session.scalars(statement).all(),
        key=latest_thread_activity,
        reverse=True,
    )[:limit]
    items: list[DomainHistoryItem] = []

    for thread in threads:
        turns = list(thread.turns)
        variants = [variant for turn in turns for variant in turn.variants]
        items.append(
            DomainHistoryItem(
                session=thread.session,
                thread=ConversationThreadSnapshot(thread=thread, turns=turns, variants=variants),
            )
        )

    return items


def latest_thread_activity(thread: ConversationThread) -> object:
    timestamps = [thread.updated_at, thread.created_at]

    for turn in thread.turns:
        timestamps.extend([turn.updated_at, turn.created_at])
        for variant in turn.variants:
            timestamps.extend([variant.updated_at, variant.created_at])

    return max(timestamp for timestamp in timestamps if timestamp is not None)


def variants_for_thread(session: Session, thread_id: str) -> list[DraftVariant]:
    statement = (
        select(DraftVariant)
        .join(Turn, DraftVariant.turn_id == Turn.turn_id)
        .where(Turn.thread_id == thread_id)
    )
    return list(session.scalars(statement))


def ensure_workspace_session_exists(session: Session, session_id: str, source: SourceSnapshot) -> None:
    if session.get(WorkspaceSession, session_id):
        return

    workspace = WorkspaceSession(
        session_id=session_id,
        page_url=source.source_url,
        page_title=source.page_title,
        selected_text=source.selected_text,
        source_domain=source.source_domain,
        status="active",
    )
    session.add(workspace)
    session.commit()
