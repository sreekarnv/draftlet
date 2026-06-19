from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.db.models import GenerationRun
from app.schemas.domain import (
    GenerationRunLiveFeedAttachment,
    GenerationRunProgressEvent,
    GenerationRunProgressSnapshot,
)
from app.services.domain.constants import DEFAULT_GENERATION_RUN_EVENT_REPLAY_LIMIT
from app.services.domain.generation_events import generation_run_event_to_progress_event, list_generation_run_events
from app.services.domain.generation_lifecycle import sequence_for_generation_run_status, timestamp_for_generation_run_status
from app.services.domain.snapshots import get_thread_snapshot
from app.services.domain.variants import variants_for_turn


def get_generation_run_progress_snapshot(
    session: Session,
    run_id: str,
    after_sequence: int = 0,
    limit: int = 50,
    live_feed_attachment: GenerationRunLiveFeedAttachment | None = None,
) -> GenerationRunProgressSnapshot | None:
    run = session.get(GenerationRun, run_id)

    if not run:
        return None

    session.refresh(run)
    thread_snapshot = get_thread_snapshot(session, run.thread_id)
    all_events = build_generation_run_progress_events(session, run)
    replay_cursor = max((event.sequence for event in all_events), default=0)
    events = [event for event in all_events if event.sequence > after_sequence][-limit:]

    return GenerationRunProgressSnapshot(
        checked_at=datetime.now(UTC),
        run=run,
        thread=thread_snapshot,
        events=events,
        replay_cursor=replay_cursor,
        live_feed_attachment=live_feed_attachment
        or build_replay_only_live_feed_attachment(replay_available=bool(events), reason="progress_snapshot"),
    )


def build_replay_only_live_feed_attachment(
    replay_available: bool,
    reason: str = "no_live_producer",
) -> GenerationRunLiveFeedAttachment:
    return GenerationRunLiveFeedAttachment(
        mode="replay_only",
        live_attached=False,
        replay_available=replay_available,
        subscriber_count=0,
        reason=reason,
    )


def build_generation_run_progress_events(session: Session, run: GenerationRun) -> list[GenerationRunProgressEvent]:
    persisted_events = list_generation_run_events(
        session,
        run.run_id,
        limit=DEFAULT_GENERATION_RUN_EVENT_REPLAY_LIMIT,
    )

    if persisted_events:
        return [generation_run_event_to_progress_event(event) for event in persisted_events]

    events = [
        GenerationRunProgressEvent(
            sequence=sequence_for_generation_run_status(run.status),
            event_type="generation_run_status",
            run_id=run.run_id,
            session_id=run.session_id,
            thread_id=run.thread_id,
            turn_id=run.turn_id,
            status=run.status,
            at=timestamp_for_generation_run_status(run),
        ),
    ]

    for variant in variants_for_turn(session, run.turn_id):
        events.append(
            GenerationRunProgressEvent(
                sequence=100 + variant.rank,
                event_type="draft_variant_generated",
                run_id=run.run_id,
                session_id=run.session_id,
                thread_id=run.thread_id,
                turn_id=run.turn_id,
                status=variant.status,
                variant_id=variant.variant_id,
                at=variant.updated_at or variant.created_at,
            ),
        )

    return sorted(events, key=lambda event: event.sequence)
