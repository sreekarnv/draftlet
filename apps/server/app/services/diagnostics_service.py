from datetime import UTC, datetime

from app.schemas.diagnostics import BrowserRecaptureDiagnosticsState, RecaptureDiagnosticsReport


BROWSER_RECAPTURE_DIAGNOSTICS_STALE_AFTER_SECONDS = 15 * 60


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
