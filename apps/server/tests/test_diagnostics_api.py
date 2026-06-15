from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError
from sqlalchemy import select, create_engine
from sqlalchemy.orm import sessionmaker

from app.api.diagnostics import (
    get_browser_recapture_diagnostics,
    get_generation_run_maintenance_diagnostics,
    put_browser_recapture_diagnostics,
)
from app.db.base import Base
from app.db.models import (
    BrowserRecaptureDiagnosticEventRecord,
    BrowserRecaptureDiagnosticsReportRecord,
    GenerationRunMaintenanceOutcomeRecord,
)
from app.main import app
from app.schemas.diagnostics import RecaptureDiagnosticsReport
from app.services.diagnostics_service import (
    BROWSER_RECAPTURE_DIAGNOSTICS_STALE_AFTER_SECONDS,
    BROWSER_RECAPTURE_DIAGNOSTICS_MAX_STORED_REPORTS,
    BROWSER_RECAPTURE_DIAGNOSTICS_RETENTION_DAYS,
    GENERATION_RUN_MAINTENANCE_MAX_STORED_OUTCOMES,
    GENERATION_RUN_MAINTENANCE_RECENT_LIMIT,
    GENERATION_RUN_MAINTENANCE_RETENTION_DAYS,
    clear_generation_run_maintenance_status,
    clear_latest_browser_recapture_report,
    get_generation_run_maintenance_status,
    get_browser_recapture_diagnostics_state,
    get_latest_browser_recapture_report,
    put_latest_browser_recapture_report,
    record_generation_run_maintenance_outcome,
)


def create_test_sessionmaker():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def browser_recapture_report(
    *,
    exported_at: str = "2026-01-01T00:00:01.000Z",
    entry_id: int = 1,
    event: str = "content_recapture_completed",
    session_id: str = "session-1",
    status: str = "needs_focus",
    message: str = "Focus a compose field and retry.",
) -> dict:
    return {
        "kind": "draftlet.recapture-diagnostics",
        "exportedAt": exported_at,
        "summary": {
            "lastUpdatedAt": "2026-01-01T00:00:00.000Z",
            "entryCount": 1,
            "currentTarget": {
                "sessionId": session_id,
                "tabId": 42,
                "status": "needs_focus",
                "reason": "no_focused_compose_target",
                "message": "A compose field must be focused before recapture can complete.",
                "updatedAt": "2026-01-01T00:00:00.000Z",
            },
            "latestAttempt": {
                "event": event,
                "sessionId": session_id,
                "tabId": 42,
                "status": status,
                "outcome": "needs_focused_compose",
                "reason": "no_focused_compose",
                "message": message,
                "at": "2026-01-01T00:00:00.000Z",
            },
            "latestOutcome": {
                "event": event,
                "sessionId": session_id,
                "tabId": 42,
                "status": status,
                "outcome": "needs_focused_compose",
                "reason": "no_focused_compose",
                "message": message,
                "at": "2026-01-01T00:00:00.000Z",
            },
        },
        "entries": [
            {
                "id": entry_id,
                "event": event,
                "level": "info",
                "sessionId": session_id,
                "tabId": 42,
                "status": status,
                "outcome": "needs_focused_compose",
                "reason": "no_focused_compose",
                "message": message,
                "at": "2026-01-01T00:00:00.000Z",
            }
        ],
    }


def test_browser_recapture_diagnostics_route_stores_bounded_report_durably() -> None:
    Session = create_test_sessionmaker()
    report = browser_recapture_report()
    parsed = RecaptureDiagnosticsReport.model_validate(report)

    with Session() as session:
        clear_latest_browser_recapture_report(session)
        stored = put_browser_recapture_diagnostics(parsed, session=session)
        state = get_browser_recapture_diagnostics(session=session)
        report_count = session.query(BrowserRecaptureDiagnosticsReportRecord).count()
        event_count = session.query(BrowserRecaptureDiagnosticEventRecord).count()

    assert stored.model_dump(exclude_none=True) == report
    with Session() as session:
        assert get_latest_browser_recapture_report(session) == stored
    assert state.report == stored
    assert state.receivedAt is not None
    assert state.stale is False
    assert state.staleAfterSeconds == BROWSER_RECAPTURE_DIAGNOSTICS_STALE_AFTER_SECONDS
    assert state.retentionDays == BROWSER_RECAPTURE_DIAGNOSTICS_RETENTION_DAYS
    assert state.maxStoredReports == BROWSER_RECAPTURE_DIAGNOSTICS_MAX_STORED_REPORTS
    assert report_count == 1
    assert event_count == 1


def test_browser_recapture_diagnostics_marks_stale_report_without_losing_durable_data() -> None:
    Session = create_test_sessionmaker()
    report = RecaptureDiagnosticsReport.model_validate(browser_recapture_report())

    with Session() as session:
        clear_latest_browser_recapture_report(session)
        stored = put_latest_browser_recapture_report(report, session)
        fresh_state = get_browser_recapture_diagnostics_state(session)
        expired_state = get_browser_recapture_diagnostics_state(
            session,
            datetime.now(UTC) + timedelta(seconds=BROWSER_RECAPTURE_DIAGNOSTICS_STALE_AFTER_SECONDS + 1),
        )

    assert fresh_state.report == stored
    assert expired_state.report == stored
    assert expired_state.receivedAt == fresh_state.receivedAt
    assert expired_state.stale is True
    with Session() as session:
        assert get_latest_browser_recapture_report(session) == stored


def test_browser_recapture_diagnostics_bounds_retained_reports() -> None:
    Session = create_test_sessionmaker()

    with Session() as session:
        clear_latest_browser_recapture_report(session)

        for index in range(BROWSER_RECAPTURE_DIAGNOSTICS_MAX_STORED_REPORTS + 3):
            put_latest_browser_recapture_report(
                RecaptureDiagnosticsReport.model_validate(
                    browser_recapture_report(
                        exported_at=f"2026-01-01T00:00:{index:02d}.000Z",
                        entry_id=index + 1,
                        session_id=f"session-{index}",
                    )
                ),
                session,
            )

        state = get_browser_recapture_diagnostics_state(session)
        retained_report_ids = list(session.scalars(select(BrowserRecaptureDiagnosticsReportRecord.report_id)))
        retained_event_ids = list(session.scalars(select(BrowserRecaptureDiagnosticEventRecord.event_record_id)))

    assert len(retained_report_ids) == BROWSER_RECAPTURE_DIAGNOSTICS_MAX_STORED_REPORTS
    assert len(retained_event_ids) == BROWSER_RECAPTURE_DIAGNOSTICS_MAX_STORED_REPORTS
    assert state.report.entries[0].id == BROWSER_RECAPTURE_DIAGNOSTICS_MAX_STORED_REPORTS + 3


def test_browser_recapture_diagnostics_prunes_expired_reports() -> None:
    Session = create_test_sessionmaker()

    with Session() as session:
        clear_latest_browser_recapture_report(session)
        old = put_latest_browser_recapture_report(
            RecaptureDiagnosticsReport.model_validate(browser_recapture_report(session_id="old")),
            session,
        )
        fresh = put_latest_browser_recapture_report(
            RecaptureDiagnosticsReport.model_validate(browser_recapture_report(session_id="fresh", exported_at="2026-01-01T00:00:02.000Z")),
            session,
        )
        old_record = session.scalar(
            select(BrowserRecaptureDiagnosticsReportRecord)
            .where(BrowserRecaptureDiagnosticsReportRecord.exported_at == old.exportedAt)
        )
        old_record.received_at = datetime.now(UTC) - timedelta(days=BROWSER_RECAPTURE_DIAGNOSTICS_RETENTION_DAYS + 1)
        session.add(old_record)
        session.commit()

        state = get_browser_recapture_diagnostics_state(session)
        retained_sessions = list(session.scalars(select(BrowserRecaptureDiagnosticEventRecord.session_id)))

    assert state.report.exportedAt == fresh.exportedAt
    assert retained_sessions == ["fresh"]


def test_browser_recapture_diagnostics_rejects_unbounded_fields() -> None:
    with pytest.raises(ValidationError):
        RecaptureDiagnosticsReport.model_validate(
            {
                "kind": "draftlet.recapture-diagnostics",
                "exportedAt": "2026-01-01T00:00:01.000Z",
                "summary": {
                    "lastUpdatedAt": "2026-01-01T00:00:00.000Z",
                    "entryCount": 1,
                },
                "entries": [
                    {
                        "id": 1,
                        "event": "content_recapture_completed",
                        "level": "info",
                        "sessionId": "session-1",
                        "message": "Focus a compose field and retry.",
                        "at": "2026-01-01T00:00:00.000Z",
                        "selectedText": "private page text",
                    }
                ],
            },
        )


def test_generation_run_maintenance_diagnostics_route_is_registered() -> None:
    assert any(
        route.path == "/diagnostics/generation-runs/maintenance" and "GET" in route.methods
        for route in app.routes
        if hasattr(route, "methods")
    )


def test_generation_run_maintenance_diagnostics_returns_durable_bounded_status() -> None:
    Session = create_test_sessionmaker()

    with Session() as session:
        clear_generation_run_maintenance_status(session)
        record_generation_run_maintenance_outcome(
            "stale_reconciliation",
            source="domain_reconcile_endpoint",
            reconciled_run_ids=["run-1", "run-2"],
            stale_after_seconds=0,
            session=session,
        )
        record_generation_run_maintenance_outcome(
            "replay_prune",
            source="startup",
            pruned_event_count=5,
            retention_days=14,
            replay_limit=100,
            prune_batch_size=200,
            session=session,
        )
        record_generation_run_maintenance_outcome(
            "startup_maintenance",
            source="startup",
            reconciled_run_ids=["run-1"],
            pruned_event_count=5,
            stale_after_seconds=0,
            retention_days=14,
            replay_limit=100,
            prune_batch_size=200,
            session=session,
        )

    with Session() as session:
        status = get_generation_run_maintenance_diagnostics(session=session)

    assert status.processLocal is False
    assert status.recentLimit == GENERATION_RUN_MAINTENANCE_RECENT_LIMIT
    assert status.retentionDays == GENERATION_RUN_MAINTENANCE_RETENTION_DAYS
    assert status.maxStoredOutcomes == GENERATION_RUN_MAINTENANCE_MAX_STORED_OUTCOMES
    assert status.latestStartup.reconciledRunCount == 1
    assert status.latestStartup.prunedEventCount == 5
    assert status.latestStaleReconciliation.reconciledRunIds == ["run-1", "run-2"]
    assert status.latestReplayPrune.prunedEventCount == 5
    assert [event.operation for event in status.recent] == [
        "stale_reconciliation",
        "replay_prune",
        "startup_maintenance",
    ]


def test_generation_run_maintenance_diagnostics_bounds_recent_and_retained_outcomes() -> None:
    Session = create_test_sessionmaker()

    with Session() as session:
        clear_generation_run_maintenance_status(session)

        for index in range(GENERATION_RUN_MAINTENANCE_MAX_STORED_OUTCOMES + 3):
            record_generation_run_maintenance_outcome(
                "replay_prune",
                source=f"source-{index}",
                pruned_event_count=index,
                session=session,
            )

        status = get_generation_run_maintenance_status(session)
        retained_ids = list(session.scalars(select(GenerationRunMaintenanceOutcomeRecord.outcome_id)))

    assert len(retained_ids) == GENERATION_RUN_MAINTENANCE_MAX_STORED_OUTCOMES
    assert len(status.recent) == GENERATION_RUN_MAINTENANCE_RECENT_LIMIT
    assert status.recent[0].source == f"source-{GENERATION_RUN_MAINTENANCE_MAX_STORED_OUTCOMES + 3 - GENERATION_RUN_MAINTENANCE_RECENT_LIMIT}"
    assert status.latestReplayPrune.prunedEventCount == GENERATION_RUN_MAINTENANCE_MAX_STORED_OUTCOMES + 2


def test_generation_run_maintenance_diagnostics_prunes_expired_outcomes() -> None:
    Session = create_test_sessionmaker()

    with Session() as session:
        clear_generation_run_maintenance_status(session)
        old = record_generation_run_maintenance_outcome("startup_maintenance", source="old", session=session)
        fresh = record_generation_run_maintenance_outcome("startup_maintenance", source="fresh", session=session)
        old_record = session.get(GenerationRunMaintenanceOutcomeRecord, old.id)
        old_record.at = datetime.now(UTC) - timedelta(days=GENERATION_RUN_MAINTENANCE_RETENTION_DAYS + 1)
        session.add(old_record)
        session.commit()

        status = get_generation_run_maintenance_status(session)
        retained_sources = [record.source for record in session.scalars(select(GenerationRunMaintenanceOutcomeRecord))]

    assert status.latestStartup.id == fresh.id
    assert retained_sources == ["fresh"]
