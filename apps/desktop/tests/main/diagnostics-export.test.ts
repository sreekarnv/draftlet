import { describe, expect, it } from 'vitest';

import {
  buildDesktopDiagnosticsExportPayload,
  serializeDesktopDiagnosticsExportPayload,
} from '../../src/renderer/lib/diagnostics-export';
import type { BrowserDiagnosticsBridgeResult, RuntimeMaintenanceDiagnosticsResult, RuntimeState } from '../../src/renderer/lib/types';

function runtimeState(): RuntimeState {
  return {
    server: { ok: true, message: 'ok', code: 'ready' },
    ollamaInstalled: { ok: true, message: 'installed', code: 'ready' },
    ollamaRunning: { ok: true, message: 'running', code: 'ready' },
    model: { ok: true, message: 'gemma3:4b', code: 'ready' },
    installedModels: [{ name: 'gemma3:4b' }],
    selectedModel: 'gemma3:4b',
  };
}

function loadedBrowserResult(): BrowserDiagnosticsBridgeResult {
  return {
    ok: true,
    protocol: 'draftlet.desktop-extension-diagnostics.v1',
    report: {
      kind: 'draftlet.recapture-diagnostics',
      exportedAt: '2026-01-01T00:00:00.000Z',
      summary: {
        lastUpdatedAt: '2026-01-01T00:00:00.000Z',
        entryCount: 1,
        latestAttempt: {
          event: 'content_recapture_completed',
          sessionId: 'session-1',
          tabId: 10,
          status: 'live',
          message: 'Recaptured.',
          at: '2026-01-01T00:00:00.000Z',
        },
      },
      entries: [
        {
          id: 1,
          event: 'content_recapture_completed',
          level: 'info',
          sessionId: 'session-1',
          tabId: 10,
          status: 'live',
          message: 'Recaptured.',
          at: '2026-01-01T00:00:00.000Z',
        },
      ],
    },
    receivedAt: '2026-01-01T00:00:00.000Z',
    stale: false,
    staleAfterSeconds: 900,
    retentionDays: 14,
    maxStoredReports: 50,
    maxEntriesPerReport: 500,
  };
}

function loadedMaintenanceResult(): RuntimeMaintenanceDiagnosticsResult {
  return {
    ok: true,
    protocol: 'draftlet.generation-run-maintenance-diagnostics.v1',
    status: {
      checkedAt: '2026-01-01T00:00:00.000Z',
      processLocal: false,
      interruptedRuns: 0,
      terminalRuns: 5,
      replayRetentionDays: 14,
      replayMaxRows: 100,
      staleAfterSeconds: 30,
      notes: [],
    },
  };
}

describe('buildDesktopDiagnosticsExportPayload', () => {
  it('returns a loaded payload when both diagnostics and runtime are available', () => {
    const payload = buildDesktopDiagnosticsExportPayload({
      browserDiagnostics: loadedBrowserResult(),
      diagnosticsLastRefreshedAt: '2026-01-01T00:00:00.000Z',
      maintenanceDiagnostics: loadedMaintenanceResult(),
      runtime: runtimeState(),
      exportedAt: '2026-01-01T00:00:01.000Z',
    });

    expect(payload.kind).toBe('draftlet.desktop-diagnostics-export');
    expect(payload.version).toBe(1);
    expect(payload.exported_at).toBe('2026-01-01T00:00:01.000Z');
    expect(payload.diagnostics_last_refreshed_at).toBe('2026-01-01T00:00:00.000Z');
    expect(payload.availability).toEqual({
      browser_recapture_diagnostics: 'loaded',
      generation_run_maintenance_diagnostics: 'loaded',
      runtime_status: 'loaded',
    });
    expect(payload.runtime_status.server.code).toBe('ready');
    expect(payload.runtime_status.selected_model).toBe('gemma3:4b');
    if (payload.browser_recapture_diagnostics.availability === 'loaded') {
      expect(payload.browser_recapture_diagnostics.stale_after_seconds).toBe(900);
      expect(payload.browser_recapture_diagnostics.report.entries).toHaveLength(1);
    } else {
      throw new Error('Expected loaded browser recapture diagnostics.');
    }
    if (payload.generation_run_maintenance_diagnostics.availability === 'loaded') {
      expect(payload.generation_run_maintenance_diagnostics.process_local).toBe(false);
    } else {
      throw new Error('Expected loaded maintenance diagnostics.');
    }
  });

  it('marks both diagnostics sections as not_loaded when not yet fetched', () => {
    const payload = buildDesktopDiagnosticsExportPayload({
      browserDiagnostics: null,
      diagnosticsLastRefreshedAt: null,
      maintenanceDiagnostics: null,
      runtime: runtimeState(),
    });

    expect(payload.availability).toEqual({
      browser_recapture_diagnostics: 'not_loaded',
      generation_run_maintenance_diagnostics: 'not_loaded',
      runtime_status: 'loaded',
    });
    expect(payload.browser_recapture_diagnostics).toEqual({ availability: 'not_loaded' });
    expect(payload.generation_run_maintenance_diagnostics).toEqual({ availability: 'not_loaded' });
  });

  it('marks the browser diagnostics as unavailable when the bridge failed', () => {
    const failed: BrowserDiagnosticsBridgeResult = {
      ok: false,
      protocol: 'draftlet.desktop-extension-diagnostics.v1',
      error: { code: 'diagnostics_unavailable', message: 'Server offline', retryable: true },
      receivedAt: '2026-01-01T00:00:00.000Z',
      stale: true,
      staleAfterSeconds: 900,
    };

    const payload = buildDesktopDiagnosticsExportPayload({
      browserDiagnostics: failed,
      diagnosticsLastRefreshedAt: '2026-01-01T00:00:00.000Z',
      maintenanceDiagnostics: loadedMaintenanceResult(),
      runtime: runtimeState(),
    });

    expect(payload.availability.browser_recapture_diagnostics).toBe('unavailable');
    if (payload.browser_recapture_diagnostics.availability === 'unavailable') {
      expect(payload.browser_recapture_diagnostics.error.code).toBe('diagnostics_unavailable');
      expect(payload.browser_recapture_diagnostics.stale).toBe(true);
    } else {
      throw new Error('Expected unavailable browser diagnostics.');
    }
  });
});

describe('serializeDesktopDiagnosticsExportPayload', () => {
  it('returns a pretty-printed JSON string that includes the kind marker and runtime snapshot', () => {
    const payload = buildDesktopDiagnosticsExportPayload({
      browserDiagnostics: loadedBrowserResult(),
      diagnosticsLastRefreshedAt: '2026-01-01T00:00:00.000Z',
      maintenanceDiagnostics: loadedMaintenanceResult(),
      runtime: runtimeState(),
    });

    const json = serializeDesktopDiagnosticsExportPayload(payload);

    expect(json).toContain('"kind": "draftlet.desktop-diagnostics-export"');
    expect(json).toContain('"selected_model": "gemma3:4b"');
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
