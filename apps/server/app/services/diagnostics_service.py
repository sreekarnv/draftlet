from datetime import UTC, datetime

from app.schemas.diagnostics import (
    BrowserRecaptureDiagnosticsState,
    GenerationRunMaintenanceOutcome,
    GenerationRunMaintenanceStatus,
    RecaptureDiagnosticsReport,
)


BROWSER_RECAPTURE_DIAGNOSTICS_STALE_AFTER_SECONDS = 15 * 60
GENERATION_RUN_MAINTENANCE_RECENT_LIMIT = 20


_latest_browser_recapture_report: RecaptureDiagnosticsReport | None = None
_latest_browser_recapture_received_at: datetime | None = None
_generation_run_maintenance_events: list[GenerationRunMaintenanceOutcome] = []
_next_generation_run_maintenance_event_id = 1


def get_latest_browser_recapture_report() -> RecaptureDiagnosticsReport | None:
    return _latest_browser_recapture_report


def get_browser_recapture_diagnostics_state(now: datetime | None = None) -> BrowserRecaptureDiagnosticsState:
    global _latest_browser_recapture_report

    checked_at = now or datetime.now(UTC)
    received_at = _latest_browser_recapture_received_at

    if _latest_browser_recapture_report is not None and received_at is not None:
        age_seconds = (checked_at - received_at).total_seconds()

        if age_seconds > BROWSER_RECAPTURE_DIAGNOSTICS_STALE_AFTER_SECONDS:
            _latest_browser_recapture_report = None
            return BrowserRecaptureDiagnosticsState(
                report=None,
                receivedAt=received_at.isoformat(),
                stale=True,
                staleAfterSeconds=BROWSER_RECAPTURE_DIAGNOSTICS_STALE_AFTER_SECONDS,
            )

    return BrowserRecaptureDiagnosticsState(
        report=_latest_browser_recapture_report,
        receivedAt=received_at.isoformat() if received_at else None,
        stale=False,
        staleAfterSeconds=BROWSER_RECAPTURE_DIAGNOSTICS_STALE_AFTER_SECONDS,
    )


def put_latest_browser_recapture_report(report: RecaptureDiagnosticsReport) -> RecaptureDiagnosticsReport:
    global _latest_browser_recapture_received_at, _latest_browser_recapture_report
    _latest_browser_recapture_report = report
    _latest_browser_recapture_received_at = datetime.now(UTC)
    return _latest_browser_recapture_report


def clear_latest_browser_recapture_report() -> None:
    global _latest_browser_recapture_received_at, _latest_browser_recapture_report
    _latest_browser_recapture_report = None
    _latest_browser_recapture_received_at = None


def record_generation_run_maintenance_outcome(
    operation: str,
    status: str = "ok",
    source: str | None = None,
    reconciled_run_ids: list[str] | None = None,
    pruned_event_count: int = 0,
    stale_after_seconds: int | None = None,
    retention_days: int | None = None,
    replay_limit: int | None = None,
    prune_batch_size: int | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
) -> GenerationRunMaintenanceOutcome:
    global _generation_run_maintenance_events, _next_generation_run_maintenance_event_id

    bounded_run_ids = (reconciled_run_ids or [])[:20]
    outcome = GenerationRunMaintenanceOutcome(
        id=_next_generation_run_maintenance_event_id,
        operation=operation,
        status=status,
        source=source,
        at=datetime.now(UTC),
        reconciledRunCount=len(reconciled_run_ids or []),
        reconciledRunIds=bounded_run_ids,
        prunedEventCount=pruned_event_count,
        staleAfterSeconds=stale_after_seconds,
        retentionDays=retention_days,
        replayLimit=replay_limit,
        pruneBatchSize=prune_batch_size,
        errorCode=error_code,
        errorMessage=error_message,
    )
    _next_generation_run_maintenance_event_id += 1
    _generation_run_maintenance_events.append(outcome)
    _generation_run_maintenance_events = _generation_run_maintenance_events[-GENERATION_RUN_MAINTENANCE_RECENT_LIMIT:]
    return outcome


def get_generation_run_maintenance_status(now: datetime | None = None) -> GenerationRunMaintenanceStatus:
    recent = list(_generation_run_maintenance_events)

    return GenerationRunMaintenanceStatus(
        checkedAt=now or datetime.now(UTC),
        recentLimit=GENERATION_RUN_MAINTENANCE_RECENT_LIMIT,
        latestStartup=latest_generation_run_maintenance_outcome(recent, "startup_maintenance"),
        latestStaleReconciliation=latest_generation_run_maintenance_outcome(recent, "stale_reconciliation"),
        latestReplayPrune=latest_generation_run_maintenance_outcome(recent, "replay_prune"),
        recent=recent,
    )


def latest_generation_run_maintenance_outcome(
    events: list[GenerationRunMaintenanceOutcome],
    operation: str,
) -> GenerationRunMaintenanceOutcome | None:
    return next((event for event in reversed(events) if event.operation == operation), None)


def clear_generation_run_maintenance_status() -> None:
    global _generation_run_maintenance_events, _next_generation_run_maintenance_event_id
    _generation_run_maintenance_events = []
    _next_generation_run_maintenance_event_id = 1
