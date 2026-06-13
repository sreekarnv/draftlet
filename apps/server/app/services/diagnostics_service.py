import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.db.models import GenerationRunMaintenanceOutcomeRecord

from app.schemas.diagnostics import (
    BrowserRecaptureDiagnosticsState,
    GenerationRunMaintenanceOutcome,
    GenerationRunMaintenanceStatus,
    RecaptureDiagnosticsReport,
)


BROWSER_RECAPTURE_DIAGNOSTICS_STALE_AFTER_SECONDS = 15 * 60
GENERATION_RUN_MAINTENANCE_RECENT_LIMIT = 20
GENERATION_RUN_MAINTENANCE_RETENTION_DAYS = 30
GENERATION_RUN_MAINTENANCE_MAX_STORED_OUTCOMES = 100
GENERATION_RUN_MAINTENANCE_RECONCILED_RUN_ID_LIMIT = 20


_latest_browser_recapture_report: RecaptureDiagnosticsReport | None = None
_latest_browser_recapture_received_at: datetime | None = None


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
    session: Session | None = None,
) -> GenerationRunMaintenanceOutcome:
    bounded_run_ids = (reconciled_run_ids or [])[:GENERATION_RUN_MAINTENANCE_RECONCILED_RUN_ID_LIMIT]
    record = GenerationRunMaintenanceOutcomeRecord(
        operation=operation,
        status=status,
        source=source,
        at=datetime.now(UTC),
        reconciled_run_count=len(reconciled_run_ids or []),
        reconciled_run_ids=json.dumps(bounded_run_ids),
        pruned_event_count=pruned_event_count,
        stale_after_seconds=stale_after_seconds,
        retention_days=retention_days,
        replay_limit=replay_limit,
        prune_batch_size=prune_batch_size,
        error_code=error_code,
        error_message=error_message,
    )

    if session is not None:
        session.add(record)
        session.commit()
        session.refresh(record)
        prune_generation_run_maintenance_outcomes(session)
        return generation_run_maintenance_record_to_outcome(record)

    with SessionLocal() as local_session:
        local_session.add(record)
        local_session.commit()
        local_session.refresh(record)
        prune_generation_run_maintenance_outcomes(local_session)
        return generation_run_maintenance_record_to_outcome(record)


def get_generation_run_maintenance_status(
    session: Session | None = None,
    now: datetime | None = None,
) -> GenerationRunMaintenanceStatus:
    if session is not None:
        return build_generation_run_maintenance_status(session, now)

    with SessionLocal() as local_session:
        return build_generation_run_maintenance_status(local_session, now)


def build_generation_run_maintenance_status(
    session: Session,
    now: datetime | None = None,
) -> GenerationRunMaintenanceStatus:
    checked_at = now or datetime.now(UTC)
    prune_generation_run_maintenance_outcomes(session, checked_at)
    recent = list_generation_run_maintenance_outcomes(session, limit=GENERATION_RUN_MAINTENANCE_RECENT_LIMIT)

    return GenerationRunMaintenanceStatus(
        checkedAt=checked_at,
        processLocal=False,
        recentLimit=GENERATION_RUN_MAINTENANCE_RECENT_LIMIT,
        retentionDays=GENERATION_RUN_MAINTENANCE_RETENTION_DAYS,
        maxStoredOutcomes=GENERATION_RUN_MAINTENANCE_MAX_STORED_OUTCOMES,
        latestStartup=get_latest_generation_run_maintenance_outcome(session, "startup_maintenance"),
        latestStaleReconciliation=get_latest_generation_run_maintenance_outcome(session, "stale_reconciliation"),
        latestReplayPrune=get_latest_generation_run_maintenance_outcome(session, "replay_prune"),
        recent=recent,
    )


def get_latest_generation_run_maintenance_outcome(
    session: Session,
    operation: str,
) -> GenerationRunMaintenanceOutcome | None:
    record = session.scalar(
        select(GenerationRunMaintenanceOutcomeRecord)
        .where(GenerationRunMaintenanceOutcomeRecord.operation == operation)
        .order_by(GenerationRunMaintenanceOutcomeRecord.at.desc(), GenerationRunMaintenanceOutcomeRecord.outcome_id.desc())
        .limit(1)
    )

    return generation_run_maintenance_record_to_outcome(record) if record else None


def list_generation_run_maintenance_outcomes(
    session: Session,
    limit: int,
) -> list[GenerationRunMaintenanceOutcome]:
    records = list(
        session.scalars(
            select(GenerationRunMaintenanceOutcomeRecord)
            .order_by(GenerationRunMaintenanceOutcomeRecord.at.desc(), GenerationRunMaintenanceOutcomeRecord.outcome_id.desc())
            .limit(limit)
        )
    )
    return [generation_run_maintenance_record_to_outcome(record) for record in reversed(records)]


def prune_generation_run_maintenance_outcomes(
    session: Session,
    now: datetime | None = None,
) -> None:
    checked_at = now or datetime.now(UTC)
    cutoff = checked_at - timedelta(days=GENERATION_RUN_MAINTENANCE_RETENTION_DAYS)
    session.execute(
        delete(GenerationRunMaintenanceOutcomeRecord)
        .where(GenerationRunMaintenanceOutcomeRecord.at < cutoff)
        .execution_options(synchronize_session=False)
    )

    overflow_ids = list(
        session.scalars(
            select(GenerationRunMaintenanceOutcomeRecord.outcome_id)
            .order_by(GenerationRunMaintenanceOutcomeRecord.at.desc(), GenerationRunMaintenanceOutcomeRecord.outcome_id.desc())
            .offset(GENERATION_RUN_MAINTENANCE_MAX_STORED_OUTCOMES)
        )
    )

    if overflow_ids:
        session.execute(
            delete(GenerationRunMaintenanceOutcomeRecord)
            .where(GenerationRunMaintenanceOutcomeRecord.outcome_id.in_(overflow_ids))
            .execution_options(synchronize_session=False)
        )

    session.commit()


def generation_run_maintenance_record_to_outcome(
    record: GenerationRunMaintenanceOutcomeRecord,
) -> GenerationRunMaintenanceOutcome:
    return GenerationRunMaintenanceOutcome(
        id=record.outcome_id,
        operation=record.operation,
        status=record.status,
        source=record.source,
        at=record.at,
        reconciledRunCount=record.reconciled_run_count,
        reconciledRunIds=parse_reconciled_run_ids(record.reconciled_run_ids),
        prunedEventCount=record.pruned_event_count,
        staleAfterSeconds=record.stale_after_seconds,
        retentionDays=record.retention_days,
        replayLimit=record.replay_limit,
        pruneBatchSize=record.prune_batch_size,
        errorCode=record.error_code,
        errorMessage=record.error_message,
    )


def parse_reconciled_run_ids(value: str) -> list[str]:
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []

    if not isinstance(parsed, list):
        return []

    return [item for item in parsed if isinstance(item, str)][:GENERATION_RUN_MAINTENANCE_RECONCILED_RUN_ID_LIMIT]


def clear_generation_run_maintenance_status(session: Session | None = None) -> None:
    if session is not None:
        session.execute(delete(GenerationRunMaintenanceOutcomeRecord))
        session.commit()
        return

    with SessionLocal() as local_session:
        clear_generation_run_maintenance_status(local_session)
