import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.database import SessionLocal
from app.db.models import (
    BrowserRecaptureDiagnosticEventRecord,
    BrowserRecaptureDiagnosticsReportRecord,
    ConversationThread,
    DraftVariant,
    GenerationRun,
    GenerationRunMaintenanceOutcomeRecord,
    Turn,
    WorkspaceSession,
)

from app.schemas.diagnostics import (
    BrowserRecaptureDiagnosticsState,
    BrowserRecaptureAttemptSummary,
    BrowserRecaptureTargetSummary,
    GenerationRunMaintenanceOutcome,
    GenerationRunMaintenanceStatus,
    RecaptureDiagnosticsReportEntry,
    RecaptureDiagnosticsReport,
    RecaptureDiagnosticsReportSummary,
)


BROWSER_RECAPTURE_DIAGNOSTICS_STALE_AFTER_SECONDS = 15 * 60
BROWSER_RECAPTURE_DIAGNOSTICS_RETENTION_DAYS = 14
BROWSER_RECAPTURE_DIAGNOSTICS_MAX_STORED_REPORTS = 20
BROWSER_RECAPTURE_DIAGNOSTICS_MAX_ENTRIES_PER_REPORT = 50
GENERATION_RUN_MAINTENANCE_RECENT_LIMIT = 20
GENERATION_RUN_MAINTENANCE_RETENTION_DAYS = 30
GENERATION_RUN_MAINTENANCE_MAX_STORED_OUTCOMES = 100
GENERATION_RUN_MAINTENANCE_RECONCILED_RUN_ID_LIMIT = 20


def get_latest_browser_recapture_report(session: Session | None = None) -> RecaptureDiagnosticsReport | None:
    if session is not None:
        record = get_latest_browser_recapture_report_record(session)
        return browser_recapture_report_record_to_report(record) if record else None

    with SessionLocal() as local_session:
        return get_latest_browser_recapture_report(local_session)


def get_browser_recapture_diagnostics_state(
    session: Session | None = None,
    now: datetime | None = None,
) -> BrowserRecaptureDiagnosticsState:
    if session is not None:
        return build_browser_recapture_diagnostics_state(session, now)

    with SessionLocal() as local_session:
        return build_browser_recapture_diagnostics_state(local_session, now)


def build_browser_recapture_diagnostics_state(
    session: Session,
    now: datetime | None = None,
) -> BrowserRecaptureDiagnosticsState:
    prune_browser_recapture_diagnostics(session, now)

    checked_at = now or datetime.now(UTC)
    record = get_latest_browser_recapture_report_record(session)
    report = browser_recapture_report_record_to_report(record) if record else None
    received_at = ensure_aware(record.received_at) if record else None
    stale = False

    if received_at is not None:
        stale = (checked_at - received_at).total_seconds() > BROWSER_RECAPTURE_DIAGNOSTICS_STALE_AFTER_SECONDS

    return BrowserRecaptureDiagnosticsState(
        report=report,
        receivedAt=received_at.isoformat() if received_at else None,
        stale=stale,
        staleAfterSeconds=BROWSER_RECAPTURE_DIAGNOSTICS_STALE_AFTER_SECONDS,
        retentionDays=BROWSER_RECAPTURE_DIAGNOSTICS_RETENTION_DAYS,
        maxStoredReports=BROWSER_RECAPTURE_DIAGNOSTICS_MAX_STORED_REPORTS,
        maxEntriesPerReport=BROWSER_RECAPTURE_DIAGNOSTICS_MAX_ENTRIES_PER_REPORT,
    )


def put_latest_browser_recapture_report(
    report: RecaptureDiagnosticsReport,
    session: Session | None = None,
) -> RecaptureDiagnosticsReport:
    if session is not None:
        return store_browser_recapture_report(session, report)

    with SessionLocal() as local_session:
        return store_browser_recapture_report(local_session, report)


def store_browser_recapture_report(
    session: Session,
    report: RecaptureDiagnosticsReport,
    received_at: datetime | None = None,
) -> RecaptureDiagnosticsReport:
    bounded_entries = report.entries[-BROWSER_RECAPTURE_DIAGNOSTICS_MAX_ENTRIES_PER_REPORT:]
    summary = report.summary.model_copy(update={"entryCount": len(bounded_entries)})
    record = BrowserRecaptureDiagnosticsReportRecord(
        kind=report.kind,
        exported_at=report.exportedAt,
        received_at=received_at or datetime.now(UTC),
        last_updated_at=summary.lastUpdatedAt,
        entry_count=summary.entryCount,
        current_target_json=summary.currentTarget.model_dump_json(exclude_none=True) if summary.currentTarget else None,
        latest_attempt_json=summary.latestAttempt.model_dump_json(exclude_none=True) if summary.latestAttempt else None,
        latest_outcome_json=summary.latestOutcome.model_dump_json(exclude_none=True) if summary.latestOutcome else None,
    )
    session.add(record)
    session.flush()

    for entry in bounded_entries:
        session.add(
            BrowserRecaptureDiagnosticEventRecord(
                report_id=record.report_id,
                source_entry_id=entry.id,
                event=entry.event,
                level=entry.level,
                session_id=entry.sessionId,
                tab_id=entry.tabId,
                status=entry.status,
                outcome=entry.outcome,
                reason=entry.reason,
                message=entry.message,
                at=entry.at,
                received_at=record.received_at,
            )
        )

    session.commit()
    session.refresh(record)
    prune_browser_recapture_diagnostics(session)
    return browser_recapture_report_record_to_report(record)


def get_latest_browser_recapture_report_record(
    session: Session,
) -> BrowserRecaptureDiagnosticsReportRecord | None:
    return session.scalar(
        select(BrowserRecaptureDiagnosticsReportRecord)
        .options(selectinload(BrowserRecaptureDiagnosticsReportRecord.events))
        .order_by(
            BrowserRecaptureDiagnosticsReportRecord.received_at.desc(),
            BrowserRecaptureDiagnosticsReportRecord.report_id.desc(),
        )
        .limit(1)
    )


def browser_recapture_report_record_to_report(
    record: BrowserRecaptureDiagnosticsReportRecord,
) -> RecaptureDiagnosticsReport:
    entries = [
        RecaptureDiagnosticsReportEntry(
            id=event.source_entry_id,
            event=event.event,
            level=event.level,
            sessionId=event.session_id,
            tabId=event.tab_id,
            status=event.status,
            outcome=event.outcome,
            reason=event.reason,
            message=event.message,
            at=event.at,
        )
        for event in record.events
    ]

    summary = RecaptureDiagnosticsReportSummary(
        lastUpdatedAt=record.last_updated_at,
        entryCount=len(entries),
        currentTarget=parse_json_model(record.current_target_json, BrowserRecaptureTargetSummary),
        latestAttempt=parse_json_model(record.latest_attempt_json, BrowserRecaptureAttemptSummary),
        latestOutcome=parse_json_model(record.latest_outcome_json, BrowserRecaptureAttemptSummary),
    )

    return RecaptureDiagnosticsReport(
        kind=record.kind,
        exportedAt=record.exported_at,
        summary=summary,
        entries=entries,
    )


def prune_browser_recapture_diagnostics(
    session: Session,
    now: datetime | None = None,
) -> None:
    checked_at = now or datetime.now(UTC)
    cutoff = checked_at - timedelta(days=BROWSER_RECAPTURE_DIAGNOSTICS_RETENTION_DAYS)
    expired_ids = list(
        session.scalars(
            select(BrowserRecaptureDiagnosticsReportRecord.report_id)
            .where(BrowserRecaptureDiagnosticsReportRecord.received_at < cutoff)
        )
    )

    overflow_ids = list(
        session.scalars(
            select(BrowserRecaptureDiagnosticsReportRecord.report_id)
            .order_by(
                BrowserRecaptureDiagnosticsReportRecord.received_at.desc(),
                BrowserRecaptureDiagnosticsReportRecord.report_id.desc(),
            )
            .offset(BROWSER_RECAPTURE_DIAGNOSTICS_MAX_STORED_REPORTS)
        )
    )

    removable_ids = [*expired_ids, *overflow_ids]

    if removable_ids:
        session.execute(
            delete(BrowserRecaptureDiagnosticEventRecord)
            .where(BrowserRecaptureDiagnosticEventRecord.report_id.in_(removable_ids))
            .execution_options(synchronize_session=False)
        )
        session.execute(
            delete(BrowserRecaptureDiagnosticsReportRecord)
            .where(BrowserRecaptureDiagnosticsReportRecord.report_id.in_(removable_ids))
            .execution_options(synchronize_session=False)
        )

    session.commit()


def clear_latest_browser_recapture_report(session: Session | None = None) -> None:
    if session is not None:
        session.execute(delete(BrowserRecaptureDiagnosticEventRecord))
        session.execute(delete(BrowserRecaptureDiagnosticsReportRecord))
        session.commit()
        return

    with SessionLocal() as local_session:
        clear_latest_browser_recapture_report(local_session)


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


def parse_json_model(value: str | None, model_type):
    if not value:
        return None

    try:
        return model_type.model_validate_json(value)
    except ValueError:
        return None


def ensure_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)

    return value


def clear_generation_run_maintenance_status(session: Session | None = None) -> None:
    if session is not None:
        session.execute(delete(GenerationRunMaintenanceOutcomeRecord))
        session.commit()
        return

    with SessionLocal() as local_session:
        clear_generation_run_maintenance_status(local_session)


def count_durable_records(session: Session) -> dict[str, int]:
    workspace_sessions = int(session.scalar(select(func.count()).select_from(WorkspaceSession)) or 0)
    conversation_threads = int(session.scalar(select(func.count()).select_from(ConversationThread)) or 0)
    turns = int(session.scalar(select(func.count()).select_from(Turn)) or 0)
    draft_variants = int(session.scalar(select(func.count()).select_from(DraftVariant)) or 0)
    generation_runs = int(session.scalar(select(func.count()).select_from(GenerationRun)) or 0)
    return {
        "workspace_sessions": workspace_sessions,
        "conversation_threads": conversation_threads,
        "turns": turns,
        "draft_variants": draft_variants,
        "generation_runs": generation_runs,
    }
