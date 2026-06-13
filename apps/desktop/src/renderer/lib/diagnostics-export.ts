import type { BrowserDiagnosticsBridgeResult, RuntimeMaintenanceDiagnosticsResult, RuntimeState } from './types';

const DESKTOP_DIAGNOSTICS_EXPORT_KIND = 'draftlet.desktop-diagnostics-export';

export type DiagnosticsExportAvailability = 'loaded' | 'not_loaded' | 'unavailable';

export interface DesktopDiagnosticsExportPayload {
  kind: typeof DESKTOP_DIAGNOSTICS_EXPORT_KIND;
  version: 1;
  exported_at: string;
  source: 'desktop-current-state';
  diagnostics_last_refreshed_at: string | null;
  availability: {
    browser_recapture_diagnostics: DiagnosticsExportAvailability;
    generation_run_maintenance_diagnostics: DiagnosticsExportAvailability;
    runtime_status: 'loaded';
  };
  runtime_status: {
    availability: 'loaded';
    server: RuntimeState['server'];
    ollama_installed: RuntimeState['ollamaInstalled'];
    ollama_running: RuntimeState['ollamaRunning'];
    model: RuntimeState['model'];
    installed_models: RuntimeState['installedModels'];
    selected_model: RuntimeState['selectedModel'];
  };
  browser_recapture_diagnostics: BrowserRecaptureDiagnosticsExportSection;
  generation_run_maintenance_diagnostics: GenerationRunMaintenanceDiagnosticsExportSection;
  notes: string[];
}

export type BrowserRecaptureDiagnosticsExportSection =
  | {
      availability: 'loaded';
      received_at?: string;
      stale?: boolean;
      stale_after_seconds?: number;
      report: Extract<BrowserDiagnosticsBridgeResult, { ok: true }>['report'];
    }
  | {
      availability: 'unavailable';
      received_at?: string;
      stale?: boolean;
      stale_after_seconds?: number;
      error: Extract<BrowserDiagnosticsBridgeResult, { ok: false }>['error'];
    }
  | {
      availability: 'not_loaded';
    };

export type GenerationRunMaintenanceDiagnosticsExportSection =
  | {
      availability: 'loaded';
      process_local: boolean;
      status: Extract<RuntimeMaintenanceDiagnosticsResult, { ok: true }>['status'];
    }
  | {
      availability: 'unavailable';
      error: Extract<RuntimeMaintenanceDiagnosticsResult, { ok: false }>['error'];
    }
  | {
      availability: 'not_loaded';
    };

interface BuildDesktopDiagnosticsExportPayloadInput {
  browserDiagnostics: BrowserDiagnosticsBridgeResult | null;
  diagnosticsLastRefreshedAt: string | null;
  exportedAt?: string;
  maintenanceDiagnostics: RuntimeMaintenanceDiagnosticsResult | null;
  runtime: RuntimeState;
}

export function buildDesktopDiagnosticsExportPayload({
  browserDiagnostics,
  diagnosticsLastRefreshedAt,
  exportedAt = new Date().toISOString(),
  maintenanceDiagnostics,
  runtime,
}: BuildDesktopDiagnosticsExportPayloadInput): DesktopDiagnosticsExportPayload {
  const browserSection = buildBrowserRecaptureDiagnosticsSection(browserDiagnostics);
  const maintenanceSection = buildGenerationRunMaintenanceDiagnosticsSection(maintenanceDiagnostics);

  return {
    kind: DESKTOP_DIAGNOSTICS_EXPORT_KIND,
    version: 1,
    exported_at: exportedAt,
    source: 'desktop-current-state',
    diagnostics_last_refreshed_at: diagnosticsLastRefreshedAt,
    availability: {
      browser_recapture_diagnostics: browserSection.availability,
      generation_run_maintenance_diagnostics: maintenanceSection.availability,
      runtime_status: 'loaded',
    },
    runtime_status: {
      availability: 'loaded',
      server: runtime.server,
      ollama_installed: runtime.ollamaInstalled,
      ollama_running: runtime.ollamaRunning,
      model: runtime.model,
      installed_models: runtime.installedModels,
      selected_model: runtime.selectedModel,
    },
    browser_recapture_diagnostics: browserSection,
    generation_run_maintenance_diagnostics: maintenanceSection,
    notes: [
      'This payload is built from diagnostics currently loaded in the desktop app.',
      'Browser recapture diagnostics are present only after the extension sends a bounded report to desktop.',
      'Generation-run maintenance diagnostics are a bounded runtime snapshot when the endpoint is available.',
    ],
  };
}

export function serializeDesktopDiagnosticsExportPayload(payload: DesktopDiagnosticsExportPayload): string {
  return JSON.stringify(payload, null, 2);
}

function buildBrowserRecaptureDiagnosticsSection(
  diagnostics: BrowserDiagnosticsBridgeResult | null,
): BrowserRecaptureDiagnosticsExportSection {
  if (!diagnostics) {
    return { availability: 'not_loaded' };
  }

  if (diagnostics.ok) {
    return {
      availability: 'loaded',
      received_at: diagnostics.receivedAt,
      stale: diagnostics.stale,
      stale_after_seconds: diagnostics.staleAfterSeconds,
      report: diagnostics.report,
    };
  }

  return {
    availability: 'unavailable',
    received_at: diagnostics.receivedAt,
    stale: diagnostics.stale,
    stale_after_seconds: diagnostics.staleAfterSeconds,
    error: diagnostics.error,
  };
}

function buildGenerationRunMaintenanceDiagnosticsSection(
  diagnostics: RuntimeMaintenanceDiagnosticsResult | null,
): GenerationRunMaintenanceDiagnosticsExportSection {
  if (!diagnostics) {
    return { availability: 'not_loaded' };
  }

  if (diagnostics.ok) {
    return {
      availability: 'loaded',
      process_local: diagnostics.status.processLocal,
      status: diagnostics.status,
    };
  }

  return {
    availability: 'unavailable',
    error: diagnostics.error,
  };
}
