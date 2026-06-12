from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.api.diagnostics import get_browser_recapture_diagnostics, put_browser_recapture_diagnostics
from app.schemas.diagnostics import RecaptureDiagnosticsReport
from app.services.diagnostics_service import (
    BROWSER_RECAPTURE_DIAGNOSTICS_STALE_AFTER_SECONDS,
    clear_latest_browser_recapture_report,
    get_browser_recapture_diagnostics_state,
    get_latest_browser_recapture_report,
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
