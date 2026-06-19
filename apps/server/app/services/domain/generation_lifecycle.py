from datetime import UTC, datetime, timedelta

from app.db.models import GenerationRun
from app.services.domain.constants import (
    DEFAULT_GENERATION_RUN_STALE_AFTER_SECONDS,
    TERMINAL_GENERATION_RUN_STATUSES,
)


def sequence_for_generation_run_status(status: str) -> int:
    if status in TERMINAL_GENERATION_RUN_STATUSES:
        return 10000

    if status == "streaming":
        return 20

    return 10


def timestamp_for_generation_run_status(run: GenerationRun) -> datetime | None:
    if run.status == "completed":
        return run.completed_at or run.released_at or run.updated_at

    if run.status == "cancelled":
        return run.cancelled_at or run.released_at or run.updated_at

    if run.status == "interrupted":
        return run.interrupted_at or run.released_at or run.updated_at

    if run.status == "failed":
        return run.failed_at or run.released_at or run.updated_at

    return run.heartbeat_at or run.claimed_at or run.updated_at


def event_type_for_generation_run_terminal_status(status: str) -> str | None:
    if status == "completed":
        return "run_completed"

    if status == "cancelled":
        return "run_cancelled"

    if status in {"failed", "interrupted"}:
        return "run_failed"

    return None


def is_generation_run_stale(
    run: GenerationRun,
    now: datetime | None = None,
    stale_after_seconds: int = DEFAULT_GENERATION_RUN_STALE_AFTER_SECONDS,
) -> bool:
    checked_at = now or datetime.now(UTC)
    cutoff = checked_at - timedelta(seconds=stale_after_seconds)
    activity_at = as_utc(run.heartbeat_at or run.claimed_at or run.updated_at)
    return activity_at is None or activity_at <= cutoff


def as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)

    return value.astimezone(UTC)


def apply_generation_run_lifecycle(
    run: GenerationRun,
    status: str,
    error_code: str | None = None,
    error_message: str | None = None,
) -> None:
    now = datetime.now(UTC)
    run.status = status
    run.heartbeat_at = now

    if status == "streaming":
        return

    if status == "completed":
        run.completed_at = now
        run.released_at = now
        run.error_code = None
        run.error_message = None
        return

    if status == "cancelled":
        run.cancelled_at = now
        run.released_at = now
        run.error_code = error_code
        run.error_message = error_message
        return

    if status == "interrupted":
        run.interrupted_at = now
        run.released_at = now
        run.error_code = error_code
        run.error_message = error_message
        return

    if status == "failed":
        run.failed_at = now
        run.released_at = now
        run.error_code = error_code
        run.error_message = error_message
