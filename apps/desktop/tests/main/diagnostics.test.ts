import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ipcMainHandle, appGetPath } from '../electron-mock';

vi.mock('electron', () => ({
  ipcMain: { handle: ipcMainHandle, removeHandler: vi.fn() },
  app: { getPath: appGetPath },
}));

import {
  getBrowserRecaptureDiagnosticsReport,
  getGenerationRunMaintenanceDiagnostics,
  mapBrowserRecaptureDiagnosticsResponse,
  mapGenerationRunMaintenanceDiagnosticsResponse,
  registerDiagnosticsIpc,
} from '../../src/main/ipc/diagnostics';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
  ipcMainHandle.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('getBrowserRecaptureDiagnosticsReport', () => {
  it('maps a snake_case runtime response into a camelCase bridge result', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      report: {
        kind: 'draftlet.recapture-diagnostics',
        exported_at: '2026-01-01T00:00:00.000Z',
        summary: {
          last_updated_at: '2026-01-01T00:00:00.000Z',
          entry_count: 1,
          current_target: {
            session_id: 'session-1',
            tab_id: 10,
            status: 'live',
            message: 'target message',
            updated_at: '2026-01-01T00:00:00.000Z',
            candidate_count: 2,
          },
          latest_attempt: {
            event: 'content_recapture_completed',
            session_id: 'session-1',
            tab_id: 10,
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
            session_id: 'session-1',
            tab_id: 10,
            status: 'live',
            message: 'Recaptured.',
            at: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
      received_at: '2026-01-01T00:00:00.000Z',
      stale: false,
      stale_after_seconds: 900,
      retention_days: 14,
      max_stored_reports: 50,
      max_entries_per_report: 500,
    }));

    const result = await getBrowserRecaptureDiagnosticsReport();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.protocol).toBe('draftlet.desktop-extension-diagnostics.v1');
      expect(result.report.entries).toHaveLength(1);
      expect(result.staleAfterSeconds).toBe(900);
      expect(result.retentionDays).toBe(14);
      expect(result.maxStoredReports).toBe(50);
      expect(result.maxEntriesPerReport).toBe(500);
      expect(result.receivedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(result.stale).toBe(false);
      expect(result.report.exportedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(result.report.summary.entryCount).toBe(1);
      expect(result.report.summary.lastUpdatedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(result.report.summary.currentTarget?.sessionId).toBe('session-1');
      expect(result.report.summary.currentTarget?.tabId).toBe(10);
      expect(result.report.summary.currentTarget?.candidateCount).toBe(2);
      expect(result.report.summary.latestAttempt?.sessionId).toBe('session-1');
      expect(result.report.entries[0].sessionId).toBe('session-1');
      expect(result.report.entries[0].tabId).toBe(10);
    } else {
      throw new Error('Expected ok result.');
    }
  });

  it('returns a failure when the server responds with a non-ok status', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }));

    const result = await getBrowserRecaptureDiagnosticsReport();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('diagnostics_unavailable');
      expect(result.error.message).toContain('500');
    } else {
      throw new Error('Expected failure result.');
    }
  });

  it('returns a stale failure when the report expired', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      report: null,
      received_at: '2026-01-01T00:00:00.000Z',
      stale: true,
      stale_after_seconds: 900,
      retention_days: 14,
      max_stored_reports: 50,
      max_entries_per_report: 500,
    }));

    const result = await getBrowserRecaptureDiagnosticsReport();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('report_expired');
      expect(result.staleAfterSeconds).toBe(900);
      expect(result.retentionDays).toBe(14);
      expect(result.maxStoredReports).toBe(50);
      expect(result.maxEntriesPerReport).toBe(500);
    } else {
      throw new Error('Expected failure result.');
    }
  });

  it('returns a not-published failure when the report was never set', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      report: null,
      stale: false,
      stale_after_seconds: 900,
      retention_days: 14,
      max_stored_reports: 50,
      max_entries_per_report: 500,
    }));

    const result = await getBrowserRecaptureDiagnosticsReport();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('report_not_published');
    } else {
      throw new Error('Expected failure result.');
    }
  });

  it('returns a transport failure when the fetch rejects', async () => {
    fetchMock.mockRejectedValueOnce(new Error('socket closed'));

    const result = await getBrowserRecaptureDiagnosticsReport();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('transport_unavailable');
    } else {
      throw new Error('Expected failure result.');
    }
  });
});

describe('getGenerationRunMaintenanceDiagnostics', () => {
  it('maps a snake_case runtime status into a camelCase desktop result', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      checked_at: '2026-01-01T00:00:00.000Z',
      process_local: false,
      recent_limit: 20,
      retention_days: 30,
      max_stored_outcomes: 100,
      latest_startup: {
        id: 1,
        operation: 'startup_maintenance',
        status: 'ok',
        source: 'startup',
        at: '2026-01-01T00:00:00.000Z',
        reconciled_run_count: 0,
        reconciled_run_ids: [],
        pruned_event_count: 0,
        stale_after_seconds: 0,
        retention_days: 14,
        replay_limit: 100,
        prune_batch_size: 200,
        error_code: null,
        error_message: null,
      },
      latest_stale_reconciliation: {
        id: 2,
        operation: 'stale_reconciliation',
        status: 'ok',
        source: 'startup',
        at: '2026-01-01T00:00:00.000Z',
        reconciled_run_count: 0,
        reconciled_run_ids: [],
        pruned_event_count: 0,
        stale_after_seconds: 0,
      },
      latest_replay_prune: null,
      recent: [],
    }));

    const result = await getGenerationRunMaintenanceDiagnostics();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.protocol).toBe('draftlet.generation-run-maintenance-diagnostics.v1');
      expect(result.status.checkedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(result.status.processLocal).toBe(false);
      expect(result.status.recentLimit).toBe(20);
      expect(result.status.retentionDays).toBe(30);
      expect(result.status.maxStoredOutcomes).toBe(100);
      expect(result.status.latestStartup?.operation).toBe('startup_maintenance');
      expect(result.status.latestStartup?.reconciledRunCount).toBe(0);
      expect(result.status.latestStartup?.prunedEventCount).toBe(0);
      expect(result.status.latestStartup?.staleAfterSeconds).toBe(0);
      expect(result.status.latestStartup?.retentionDays).toBe(14);
      expect(result.status.latestStartup?.replayLimit).toBe(100);
      expect(result.status.latestStartup?.pruneBatchSize).toBe(200);
      expect(result.status.latestStaleReconciliation?.operation).toBe('stale_reconciliation');
      expect(result.status.latestStaleReconciliation?.staleAfterSeconds).toBe(0);
      expect(result.status.latestReplayPrune).toBeNull();
      expect(result.status.recent).toEqual([]);
    } else {
      throw new Error('Expected ok result.');
    }
  });

  it('returns a failure when the server responds with a non-ok status', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }));

    const result = await getGenerationRunMaintenanceDiagnostics();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('diagnostics_unavailable');
    } else {
      throw new Error('Expected failure result.');
    }
  });

  it('returns a transport failure when the fetch rejects', async () => {
    fetchMock.mockRejectedValueOnce(new Error('econnrefused'));

    const result = await getGenerationRunMaintenanceDiagnostics();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('transport_unavailable');
    } else {
      throw new Error('Expected failure result.');
    }
  });
});

describe('mapBrowserRecaptureDiagnosticsResponse', () => {
  it('converts top-level snake_case fields to camelCase', () => {
    const result = mapBrowserRecaptureDiagnosticsResponse({
      report: null,
      received_at: '2026-01-01T00:00:00.000Z',
      stale: true,
      stale_after_seconds: 900,
      retention_days: 14,
      max_stored_reports: 50,
      max_entries_per_report: 500,
    });

    expect(result.receivedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.stale).toBe(true);
    expect(result.staleAfterSeconds).toBe(900);
    expect(result.retentionDays).toBe(14);
    expect(result.maxStoredReports).toBe(50);
    expect(result.maxEntriesPerReport).toBe(500);
  });

  it('recursively maps nested report, summary, target, and entry fields', () => {
    const result = mapBrowserRecaptureDiagnosticsResponse({
      report: {
        kind: 'draftlet.recapture-diagnostics',
        exported_at: '2026-01-01T00:00:00.000Z',
        summary: {
          last_updated_at: '2026-01-01T00:00:00.000Z',
          entry_count: 1,
          current_target: {
            session_id: 'session-1',
            tab_id: 7,
            status: 'live',
            message: 'msg',
            updated_at: '2026-01-01T00:00:00.000Z',
            candidate_count: 3,
          },
        },
        entries: [
          {
            id: 1,
            event: 'content_recapture_completed',
            level: 'info',
            session_id: 'session-1',
            tab_id: 7,
            status: 'live',
            message: 'Recaptured.',
            at: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
      received_at: '2026-01-01T00:00:00.000Z',
      stale: false,
      stale_after_seconds: 900,
    });

    expect(result.report?.exportedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.report?.summary.lastUpdatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.report?.summary.entryCount).toBe(1);
    expect(result.report?.summary.currentTarget?.sessionId).toBe('session-1');
    expect(result.report?.summary.currentTarget?.tabId).toBe(7);
    expect(result.report?.summary.currentTarget?.updatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.report?.summary.currentTarget?.candidateCount).toBe(3);
    expect(result.report?.entries[0].sessionId).toBe('session-1');
    expect(result.report?.entries[0].tabId).toBe(7);
  });

  it('leaves already-camelCase keys unchanged', () => {
    const result = mapBrowserRecaptureDiagnosticsResponse({
      report: null,
      receivedAt: '2026-01-01T00:00:00.000Z',
      stale: false,
      staleAfterSeconds: 900,
    });

    expect(result.receivedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.staleAfterSeconds).toBe(900);
  });
});

describe('mapGenerationRunMaintenanceDiagnosticsResponse', () => {
  it('converts top-level snake_case fields to camelCase', () => {
    const result = mapGenerationRunMaintenanceDiagnosticsResponse({
      checked_at: '2026-01-01T00:00:00.000Z',
      process_local: false,
      recent_limit: 5,
      retention_days: 14,
      max_stored_outcomes: 50,
      recent: [],
    });

    expect(result.checkedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.processLocal).toBe(false);
    expect(result.recentLimit).toBe(5);
    expect(result.retentionDays).toBe(14);
    expect(result.maxStoredOutcomes).toBe(50);
    expect(result.recent).toEqual([]);
  });

  it('recursively maps nested outcome fields for latest and recent entries', () => {
    const result = mapGenerationRunMaintenanceDiagnosticsResponse({
      checked_at: '2026-01-01T00:00:00.000Z',
      process_local: false,
      recent_limit: 1,
      retention_days: 14,
      max_stored_outcomes: 50,
      latest_startup: {
        id: 11,
        operation: 'startup_maintenance',
        status: 'ok',
        source: 'startup',
        at: '2026-01-01T00:00:00.000Z',
        reconciled_run_count: 2,
        reconciled_run_ids: ['run-a', 'run-b'],
        pruned_event_count: 4,
        stale_after_seconds: 30,
        retention_days: 14,
        replay_limit: 100,
        prune_batch_size: 25,
        error_code: null,
        error_message: null,
      },
      latest_stale_reconciliation: null,
      latest_replay_prune: null,
      recent: [
        {
          id: 12,
          operation: 'stale_reconciliation',
          status: 'error',
          source: 'reconciler',
          at: '2026-01-01T00:00:00.000Z',
          reconciled_run_count: 0,
          reconciled_run_ids: [],
          pruned_event_count: 0,
          stale_after_seconds: 30,
          error_code: 'boom',
          error_message: 'kaboom',
        },
      ],
    });

    expect(result.latestStartup?.reconciledRunCount).toBe(2);
    expect(result.latestStartup?.reconciledRunIds).toEqual(['run-a', 'run-b']);
    expect(result.latestStartup?.prunedEventCount).toBe(4);
    expect(result.latestStartup?.staleAfterSeconds).toBe(30);
    expect(result.latestStartup?.replayLimit).toBe(100);
    expect(result.latestStartup?.pruneBatchSize).toBe(25);
    expect(result.latestStaleReconciliation).toBeNull();
    expect(result.latestReplayPrune).toBeNull();
    expect(result.recent[0].operation).toBe('stale_reconciliation');
    expect(result.recent[0].errorCode).toBe('boom');
    expect(result.recent[0].errorMessage).toBe('kaboom');
  });

  it('leaves already-camelCase keys unchanged', () => {
    const result = mapGenerationRunMaintenanceDiagnosticsResponse({
      checkedAt: '2026-01-01T00:00:00.000Z',
      processLocal: false,
      recentLimit: 5,
      retentionDays: 14,
      maxStoredOutcomes: 50,
      recent: [],
    });

    expect(result.checkedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.processLocal).toBe(false);
    expect(result.recentLimit).toBe(5);
  });
});

describe('registerDiagnosticsIpc', () => {
  it('registers both diagnostics handlers', () => {
    registerDiagnosticsIpc();

    expect(ipcMainHandle).toHaveBeenCalledWith('draftlet:get-browser-recapture-diagnostics-report', expect.any(Function));
    expect(ipcMainHandle).toHaveBeenCalledWith('draftlet:get-generation-run-maintenance-diagnostics', expect.any(Function));
  });
});
