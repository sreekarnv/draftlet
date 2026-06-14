import { ipcMain } from 'electron';

import {
  DESKTOP_EXTENSION_DIAGNOSTICS_BRIDGE_PROTOCOL,
  createRecaptureDiagnosticsBridgeFailure,
  type DesktopExtensionDiagnosticsBridgeResult,
  type BrowserRecaptureDiagnosticsRelayState,
} from '@draftlet/shared/contracts';
import {
  GENERATION_RUN_MAINTENANCE_DIAGNOSTICS_PROTOCOL,
  createGenerationRunMaintenanceDiagnosticsFailure,
  type GenerationRunMaintenanceDiagnosticsResult,
  type GenerationRunMaintenanceStatus,
} from '@draftlet/shared/contracts';
import { SERVER_BASE_URL } from './settings.js';

export function registerDiagnosticsIpc() {
  ipcMain.handle('draftlet:get-browser-recapture-diagnostics-report', () => getBrowserRecaptureDiagnosticsReport());
  ipcMain.handle('draftlet:get-generation-run-maintenance-diagnostics', () => getGenerationRunMaintenanceDiagnostics());
}

export async function getBrowserRecaptureDiagnosticsReport(): Promise<DesktopExtensionDiagnosticsBridgeResult> {
  try {
    const response = await fetch(`${SERVER_BASE_URL}/diagnostics/browser-recapture`, { cache: 'no-store' });

    if (!response.ok) {
      return createRecaptureDiagnosticsBridgeFailure(
        'diagnostics_unavailable',
        `Draftlet server responded with HTTP ${response.status}.`,
        true,
      );
    }

    const data = await response.json() as BrowserRecaptureDiagnosticsRelayState;

    if (!data.report) {
      return createRecaptureDiagnosticsBridgeFailure(
        data.stale ? 'report_expired' : 'report_not_published',
        data.stale
          ? 'The last browser recapture diagnostics report expired. Trigger recapture or open the extension popup to publish a fresh report.'
          : 'No browser recapture diagnostics report has been published by the extension yet.',
        true,
        {
          receivedAt: data.receivedAt,
          stale: data.stale,
          staleAfterSeconds: data.staleAfterSeconds,
          retentionDays: data.retentionDays,
          maxStoredReports: data.maxStoredReports,
          maxEntriesPerReport: data.maxEntriesPerReport,
        },
      );
    }

    return {
      ok: true,
      protocol: DESKTOP_EXTENSION_DIAGNOSTICS_BRIDGE_PROTOCOL,
      report: data.report,
      receivedAt: data.receivedAt,
      stale: data.stale,
      staleAfterSeconds: data.staleAfterSeconds,
      retentionDays: data.retentionDays,
      maxStoredReports: data.maxStoredReports,
      maxEntriesPerReport: data.maxEntriesPerReport,
    };
  } catch (error) {
    return createRecaptureDiagnosticsBridgeFailure(
      'transport_unavailable',
      `Draftlet server is not reachable: ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  }
}

export async function getGenerationRunMaintenanceDiagnostics(): Promise<GenerationRunMaintenanceDiagnosticsResult> {
  try {
    const response = await fetch(`${SERVER_BASE_URL}/diagnostics/generation-runs/maintenance`, { cache: 'no-store' });

    if (!response.ok) {
      return createGenerationRunMaintenanceDiagnosticsFailure(
        'diagnostics_unavailable',
        `Draftlet server responded with HTTP ${response.status}.`,
        true,
      );
    }

    const status = await response.json() as GenerationRunMaintenanceStatus;

    return {
      ok: true,
      protocol: GENERATION_RUN_MAINTENANCE_DIAGNOSTICS_PROTOCOL,
      status,
    };
  } catch (error) {
    return createGenerationRunMaintenanceDiagnosticsFailure(
      'transport_unavailable',
      `Draftlet server is not reachable: ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  }
}
