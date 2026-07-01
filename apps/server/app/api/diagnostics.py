from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_session

from app.schemas.diagnostics import (
    BrowserRecaptureDiagnosticsState,
    GenerationRunMaintenanceStatus,
    RecaptureDiagnosticsReport,
)
from app.schemas.support_bundle import SupportBundle
from app.services.diagnostics_service import (
    get_browser_recapture_diagnostics_state,
    get_generation_run_maintenance_status,
    put_latest_browser_recapture_report,
)
from app.services.support_bundle_service import build_support_bundle


router = APIRouter(prefix="/diagnostics", tags=["diagnostics"])


@router.get("/browser-recapture", response_model=BrowserRecaptureDiagnosticsState)
def get_browser_recapture_diagnostics(
    session: Session = Depends(get_session),
) -> BrowserRecaptureDiagnosticsState:
    return get_browser_recapture_diagnostics_state(session)


@router.put("/browser-recapture", response_model=RecaptureDiagnosticsReport)
def put_browser_recapture_diagnostics(
    report: RecaptureDiagnosticsReport,
    session: Session = Depends(get_session),
) -> RecaptureDiagnosticsReport:
    return put_latest_browser_recapture_report(report, session)


@router.get("/generation-runs/maintenance", response_model=GenerationRunMaintenanceStatus)
def get_generation_run_maintenance_diagnostics(
    session: Session = Depends(get_session),
) -> GenerationRunMaintenanceStatus:
    return get_generation_run_maintenance_status(session)


@router.get("/support-bundle", response_model=SupportBundle)
async def get_support_bundle(
    session: Session = Depends(get_session),
) -> SupportBundle:
    return await build_support_bundle(session)


__all__ = [
    "build_support_bundle",
    "get_browser_recapture_diagnostics",
    "get_generation_run_maintenance_diagnostics",
    "get_support_bundle",
    "put_browser_recapture_diagnostics",
    "router",
]
