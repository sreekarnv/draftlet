from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import ConversationThread, GenerationRun, Turn, WorkspaceSession
from app.schemas.domain import (
    ConversationThreadSnapshot,
    DomainHistoryItem,
    RecoverableRunProjection,
    WorkspaceSessionSnapshot,
)
from app.services.domain.generation_lifecycle import as_utc, timestamp_for_generation_run_status


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
    return ConversationThreadSnapshot(
        thread=thread,
        turns=turns,
        variants=variants,
        latest_recoverable_run=build_latest_recoverable_run_projection(session, thread.thread_id),
    )


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
                thread=ConversationThreadSnapshot(
                    thread=thread,
                    turns=turns,
                    variants=variants,
                    latest_recoverable_run=build_latest_recoverable_run_projection(session, thread.thread_id),
                ),
            )
        )

    return items


def list_threads_paginated(
    session: Session,
    limit: int,
    offset: int,
    source_domain: str | None = None,
    status: str | None = None,
) -> tuple[list[DomainHistoryItem], int]:
    statement = select(ConversationThread).options(
        selectinload(ConversationThread.session),
        selectinload(ConversationThread.turns).selectinload(Turn.variants),
    )

    if source_domain:
        statement = statement.where(ConversationThread.source_domain == source_domain)
    if status:
        statement = statement.where(ConversationThread.status == status)

    threads = session.scalars(statement).all()
    sorted_threads = sorted(threads, key=latest_thread_activity, reverse=True)
    total = len(sorted_threads)
    bounded = sorted_threads[offset:offset + limit]
    items: list[DomainHistoryItem] = []

    for thread in bounded:
        turns = list(thread.turns)
        variants = [variant for turn in turns for variant in turn.variants]
        items.append(
            DomainHistoryItem(
                session=thread.session,
                thread=ConversationThreadSnapshot(
                    thread=thread,
                    turns=turns,
                    variants=variants,
                    latest_recoverable_run=build_latest_recoverable_run_projection(session, thread.thread_id),
                ),
            )
        )

    return items, total


def latest_thread_activity(thread: ConversationThread) -> object:
    timestamps = [thread.updated_at, thread.created_at]

    for turn in thread.turns:
        timestamps.extend([turn.updated_at, turn.created_at])
        for variant in turn.variants:
            timestamps.extend([variant.updated_at, variant.created_at])

    return max(timestamp for timestamp in timestamps if timestamp is not None)


def build_latest_recoverable_run_projection(session: Session, thread_id: str) -> RecoverableRunProjection | None:
    statement = (
        select(GenerationRun)
        .where(GenerationRun.thread_id == thread_id)
        .options(selectinload(GenerationRun.events))
    )
    runs = list(session.scalars(statement))

    if not runs:
        return None

    latest_run = max(runs, key=latest_generation_run_activity)

    if latest_run.status != "interrupted":
        return None

    return RecoverableRunProjection(
        run_id=latest_run.run_id,
        turn_id=latest_run.turn_id,
        status=latest_run.status,
        recoverable=True,
        reason=latest_run.error_code,
        interrupted_at=latest_run.interrupted_at,
        last_event_at=latest_generation_run_event_at(latest_run),
        error_code=latest_run.error_code,
        error_message=latest_run.error_message,
    )


def latest_generation_run_activity(run: GenerationRun) -> datetime:
    candidates = [
        latest_generation_run_event_at(run),
        timestamp_for_generation_run_status(run),
        run.updated_at,
        run.claimed_at,
        run.created_at,
    ]
    return max(as_utc(timestamp) for timestamp in candidates if timestamp is not None)


def latest_generation_run_event_at(run: GenerationRun) -> datetime | None:
    return max((event.created_at for event in run.events if event.created_at is not None), default=None)
