from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db.models import GenerationRun, GenerationRunEvent
from app.schemas.domain import GenerationRunProgressEvent
from app.services.domain.constants import (
    DEFAULT_GENERATION_RUN_EVENT_PRUNE_BATCH_SIZE,
    DEFAULT_GENERATION_RUN_EVENT_REPLAY_LIMIT,
    DEFAULT_GENERATION_RUN_EVENT_RETENTION_DAYS,
    TERMINAL_GENERATION_RUN_EVENT_TYPES,
    TERMINAL_GENERATION_RUN_STATUSES,
)
from app.services.domain.generation_lifecycle import (
    as_utc,
    event_type_for_generation_run_terminal_status,
    timestamp_for_generation_run_status,
)
from app.services.domain.maintenance import record_replay_prune_maintenance


def append_generation_run_event(
    session: Session,
    run_id: str,
    event_type: str,
    status: str | None = None,
    variant_id: str | None = None,
    message: str | None = None,
    reply_text: str | None = None,
    replay_limit: int = DEFAULT_GENERATION_RUN_EVENT_REPLAY_LIMIT,
) -> GenerationRunEvent | None:
    run = session.get(GenerationRun, run_id)

    if not run:
        return None

    existing = find_existing_generation_run_event(session, run_id, event_type, variant_id)

    if existing:
        return existing

    next_sequence = (session.scalar(select(func.max(GenerationRunEvent.sequence)).where(GenerationRunEvent.run_id == run_id)) or 0) + 1
    event = GenerationRunEvent(
        run_id=run.run_id,
        sequence=next_sequence,
        event_type=event_type,
        session_id=run.session_id,
        thread_id=run.thread_id,
        turn_id=run.turn_id,
        status=status,
        variant_id=variant_id,
        message=message,
        reply_text=reply_text,
    )
    session.add(event)
    session.flush()
    prune_generation_run_events(session, run_id, replay_limit)
    session.commit()
    session.refresh(event)
    return event


def find_existing_generation_run_event(
    session: Session,
    run_id: str,
    event_type: str,
    variant_id: str | None = None,
) -> GenerationRunEvent | None:
    statement = (
        select(GenerationRunEvent)
        .where(GenerationRunEvent.run_id == run_id)
        .where(GenerationRunEvent.event_type == event_type)
    )

    if event_type == "variant_persisted" and variant_id:
        statement = statement.where(GenerationRunEvent.variant_id == variant_id)
    elif event_type == "run_started" or event_type in TERMINAL_GENERATION_RUN_EVENT_TYPES:
        pass
    else:
        return None

    return session.scalar(statement.order_by(GenerationRunEvent.sequence.asc()))


def list_generation_run_events(
    session: Session,
    run_id: str,
    after_sequence: int = 0,
    limit: int = DEFAULT_GENERATION_RUN_EVENT_REPLAY_LIMIT,
) -> list[GenerationRunEvent]:
    statement = (
        select(GenerationRunEvent)
        .where(GenerationRunEvent.run_id == run_id)
        .where(GenerationRunEvent.sequence > after_sequence)
        .order_by(GenerationRunEvent.sequence.asc())
        .limit(limit)
    )
    return list(session.scalars(statement))


def prune_generation_run_events(session: Session, run_id: str, replay_limit: int) -> None:
    if replay_limit <= 0:
        return

    old_event_ids = list(
        session.scalars(
            select(GenerationRunEvent.event_id)
            .where(GenerationRunEvent.run_id == run_id)
            .order_by(GenerationRunEvent.sequence.desc())
            .offset(replay_limit)
        )
    )

    if old_event_ids:
        session.execute(delete(GenerationRunEvent).where(GenerationRunEvent.event_id.in_(old_event_ids)))


def prune_terminal_generation_run_events(
    session: Session,
    older_than_days: int = DEFAULT_GENERATION_RUN_EVENT_RETENTION_DAYS,
    max_runs: int = DEFAULT_GENERATION_RUN_EVENT_PRUNE_BATCH_SIZE,
    maintenance_source: str = "runtime",
) -> int:
    if older_than_days <= 0 or max_runs <= 0:
        return 0

    cutoff = datetime.now(UTC) - timedelta(days=older_than_days)
    runs = list(
        session.scalars(
            select(GenerationRun)
            .where(GenerationRun.status.in_(TERMINAL_GENERATION_RUN_STATUSES))
            .order_by(GenerationRun.updated_at.asc())
            .limit(max_runs)
        )
    )
    pruned_count = 0

    for run in runs:
        terminal_at = as_utc(timestamp_for_generation_run_status(run) or run.updated_at or run.created_at)

        if not terminal_at or terminal_at > cutoff:
            continue

        result = session.execute(delete(GenerationRunEvent).where(GenerationRunEvent.run_id == run.run_id))
        pruned_count += result.rowcount or 0

    if pruned_count:
        session.commit()

    record_replay_prune_maintenance(
        session,
        maintenance_source,
        pruned_count,
        older_than_days,
        DEFAULT_GENERATION_RUN_EVENT_REPLAY_LIMIT,
        max_runs,
    )
    return pruned_count


def generation_run_event_to_progress_event(event: GenerationRunEvent) -> GenerationRunProgressEvent:
    return GenerationRunProgressEvent(
        sequence=event.sequence,
        event_type=event.event_type,
        run_id=event.run_id,
        session_id=event.session_id,
        thread_id=event.thread_id,
        turn_id=event.turn_id,
        status=event.status,
        variant_id=event.variant_id,
        at=event.created_at,
    )


def record_generation_run_terminal_event(
    session: Session,
    run: GenerationRun,
    status: str,
    message: str | None = None,
) -> GenerationRunEvent | None:
    event_type = event_type_for_generation_run_terminal_status(status)

    if not event_type:
        return None

    event = append_generation_run_event(
        session,
        run.run_id,
        event_type,
        status=status,
        message=message or run.error_message or event_type,
    )
    prune_terminal_generation_run_events(session, maintenance_source="terminal_event")
    return event
