from fastapi import APIRouter

from app.schemas.diagnostics import (
    BrowserRecaptureDiagnosticsState,
    GenerationRunMaintenanceStatus,
    RecaptureDiagnosticsReport,
)
from app.services.diagnostics_service import (
    get_browser_recapture_diagnostics_state,
    get_generation_run_maintenance_status,
    put_latest_browser_recapture_report,
)


router = APIRouter(prefix="/diagnostics", tags=["diagnostics"])


@router.get("/browser-recapture", response_model=BrowserRecaptureDiagnosticsState)
def get_browser_recapture_diagnostics() -> BrowserRecaptureDiagnosticsState:
    return get_browser_recapture_diagnostics_state()


@router.put("/browser-recapture", response_model=RecaptureDiagnosticsReport)
def put_browser_recapture_diagnostics(report: RecaptureDiagnosticsReport) -> RecaptureDiagnosticsReport:
    return put_latest_browser_recapture_report(report)


@router.get("/generation-runs/maintenance", response_model=GenerationRunMaintenanceStatus)
def get_generation_run_maintenance_diagnostics() -> GenerationRunMaintenanceStatus:
    return get_generation_run_maintenance_status()
