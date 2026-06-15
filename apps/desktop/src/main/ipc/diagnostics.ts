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

    const raw = (await response.json()) as unknown;
    const data = mapBrowserRecaptureDiagnosticsResponse(raw);

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

    const raw = (await response.json()) as unknown;
    const status = mapGenerationRunMaintenanceDiagnosticsResponse(raw);

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

export function mapBrowserRecaptureDiagnosticsResponse(
  raw: unknown,
): BrowserRecaptureDiagnosticsRelayState {
  const mapped = snakeToCamelDeep(raw) as BrowserRecaptureDiagnosticsRelayState;
  return mapped;
}

export function mapGenerationRunMaintenanceDiagnosticsResponse(
  raw: unknown,
): GenerationRunMaintenanceStatus {
  const mapped = snakeToCamelDeep(raw) as GenerationRunMaintenanceStatus;
  return mapped;
}

function snakeToCamelDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => snakeToCamelDeep(entry));
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[snakeToCamelKey(key)] = snakeToCamelDeep(entry);
    }
    return result;
  }

  return value;
}

function snakeToCamelKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_match, ch: string) => ch.toUpperCase());
}
