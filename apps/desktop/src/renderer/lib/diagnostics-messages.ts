import type { DesktopDiagnosticsExportPayload } from './diagnostics-export';

import type {
  BrowserDiagnosticsBridgeResult,
  RuntimeMaintenanceDiagnosticsResult,
} from './types';

export function formatDiagnosticsRefreshMessage(
  browserDiagnostics: BrowserDiagnosticsBridgeResult,
  maintenanceDiagnostics: RuntimeMaintenanceDiagnosticsResult,
): string {
  if (browserDiagnostics.ok && maintenanceDiagnostics.ok) {
    return 'Loaded browser insertion and draft recovery diagnostics.';
  }

  if (browserDiagnostics.ok && !maintenanceDiagnostics.ok) {
    return `Loaded browser insertion diagnostics. Draft recovery unavailable: ${maintenanceDiagnostics.error.message}`;
  }

  if (!browserDiagnostics.ok && maintenanceDiagnostics.ok) {
    return `Loaded draft recovery diagnostics. Browser insertion unavailable: ${browserDiagnostics.error.message}`;
  }

  if (!browserDiagnostics.ok && !maintenanceDiagnostics.ok) {
    return `Could not load diagnostics. Browser insertion: ${browserDiagnostics.error.message} Draft recovery: ${maintenanceDiagnostics.error.message}`;
  }

  return 'Diagnostics refresh finished.';
}

export function formatDiagnosticsExportMessage(payload: DesktopDiagnosticsExportPayload): string {
  const loadedCount = [
    payload.availability.browser_recapture_diagnostics,
    payload.availability.generation_run_maintenance_diagnostics,
  ].filter((status) => status === 'loaded').length;

  if (loadedCount === 2) {
    return 'Copied diagnostics export with browser insertion and draft recovery diagnostics.';
  }

  if (loadedCount === 1) {
    return 'Copied diagnostics export with 1 of 2 diagnostics sources loaded.';
  }

  return 'Copied diagnostics export. Diagnostics sources are marked not loaded or unavailable.';
}
