from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.api.diagnostics import (
    get_browser_recapture_diagnostics,
    get_generation_run_maintenance_diagnostics,
    put_browser_recapture_diagnostics,
)
from app.main import app
from app.schemas.diagnostics import RecaptureDiagnosticsReport
from app.services.diagnostics_service import (
    BROWSER_RECAPTURE_DIAGNOSTICS_STALE_AFTER_SECONDS,
    GENERATION_RUN_MAINTENANCE_RECENT_LIMIT,
    clear_generation_run_maintenance_status,
    clear_latest_browser_recapture_report,
    get_generation_run_maintenance_status,
    get_browser_recapture_diagnostics_state,
    get_latest_browser_recapture_report,
    record_generation_run_maintenance_outcome,
)


def test_browser_recapture_diagnostics_route_stores_bounded_report_in_memory() -> None:
    clear_latest_browser_recapture_report()
    report = {
        "kind": "draftlet.recapture-diagnostics",
        "exportedAt": "2026-01-01T00:00:01.000Z",
        "entries": [
            {
                "id": 1,
                "event": "content_recapture_completed",
                "level": "info",
                "sessionId": "session-1",
                "tabId": 42,
                "status": "needs_focus",
                "outcome": "needs_focused_compose",
                "reason": "no_focused_compose",
                "message": "Focus a compose field and retry.",
                "at": "2026-01-01T00:00:00.000Z",
            }
        ],
    }
    parsed = RecaptureDiagnosticsReport.model_validate(report)

    stored = put_browser_recapture_diagnostics(parsed)
    state = get_browser_recapture_diagnostics()

    assert stored.model_dump() == report
    assert get_latest_browser_recapture_report() == stored
    assert state.report == stored
    assert state.receivedAt is not None
    assert state.stale is False
    assert state.staleAfterSeconds == BROWSER_RECAPTURE_DIAGNOSTICS_STALE_AFTER_SECONDS


def test_browser_recapture_diagnostics_clears_stale_report() -> None:
    clear_latest_browser_recapture_report()
    report = RecaptureDiagnosticsReport.model_validate(
        {
            "kind": "draftlet.recapture-diagnostics",
            "exportedAt": "2026-01-01T00:00:01.000Z",
            "entries": [
                {
                    "id": 1,
                    "event": "content_recapture_completed",
                    "level": "info",
                    "sessionId": "session-1",
                    "message": "Focus a compose field and retry.",
                    "at": "2026-01-01T00:00:00.000Z",
                }
            ],
        },
    )

    stored = put_browser_recapture_diagnostics(report)
    fresh_state = get_browser_recapture_diagnostics_state()
    expired_state = get_browser_recapture_diagnostics_state(
        datetime.now(UTC) + timedelta(seconds=BROWSER_RECAPTURE_DIAGNOSTICS_STALE_AFTER_SECONDS + 1),
    )

    assert fresh_state.report == stored
    assert expired_state.report is None
    assert expired_state.receivedAt == fresh_state.receivedAt
    assert expired_state.stale is True
    assert get_latest_browser_recapture_report() is None


def test_browser_recapture_diagnostics_rejects_unbounded_fields() -> None:
    clear_latest_browser_recapture_report()

    with pytest.raises(ValidationError):
        RecaptureDiagnosticsReport.model_validate(
            {
                "kind": "draftlet.recapture-diagnostics",
                "exportedAt": "2026-01-01T00:00:01.000Z",
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


def test_generation_run_maintenance_diagnostics_keeps_bounded_process_local_status() -> None:
    clear_generation_run_maintenance_status()

    record_generation_run_maintenance_outcome(
        "stale_reconciliation",
        source="domain_reconcile_endpoint",
        reconciled_run_ids=["run-1", "run-2"],
        stale_after_seconds=0,
    )
    record_generation_run_maintenance_outcome(
        "replay_prune",
        source="startup",
        pruned_event_count=5,
        retention_days=14,
        replay_limit=100,
        prune_batch_size=200,
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
    )

    status = get_generation_run_maintenance_diagnostics()

    assert status.processLocal is True
    assert status.recentLimit == GENERATION_RUN_MAINTENANCE_RECENT_LIMIT
    assert status.latestStartup.reconciledRunCount == 1
    assert status.latestStartup.prunedEventCount == 5
    assert status.latestStaleReconciliation.reconciledRunIds == ["run-1", "run-2"]
    assert status.latestReplayPrune.prunedEventCount == 5
    assert [event.operation for event in status.recent] == [
        "stale_reconciliation",
        "replay_prune",
        "startup_maintenance",
    ]


def test_generation_run_maintenance_diagnostics_bounds_recent_outcomes() -> None:
    clear_generation_run_maintenance_status()

    for index in range(GENERATION_RUN_MAINTENANCE_RECENT_LIMIT + 3):
        record_generation_run_maintenance_outcome("replay_prune", source=f"source-{index}", pruned_event_count=index)

    status = get_generation_run_maintenance_status()

    assert len(status.recent) == GENERATION_RUN_MAINTENANCE_RECENT_LIMIT
    assert status.recent[0].source == "source-3"
    assert status.latestReplayPrune.prunedEventCount == GENERATION_RUN_MAINTENANCE_RECENT_LIMIT + 2
