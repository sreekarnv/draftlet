import { describe, expect, it } from 'vitest';

import {
  DESKTOP_EXTENSION_DIAGNOSTICS_BRIDGE_PROTOCOL,
  RECAPTURE_DIAGNOSTICS_REPORT_FIELDS,
  RECAPTURE_DIAGNOSTICS_REPORT_KIND,
  createRecaptureDiagnosticsBridgeFailure,
  createRecaptureDiagnosticsBridgeSuccess,
  serializeRecaptureDiagnosticsReport,
} from '../../../../shared/recapture-diagnostics-contract';
import {
  createRecaptureDiagnosticsReport,
  formatDiagnosticTime,
  recaptureDiagnosticEventLabel,
  recaptureDiagnosticLevelLabel,
  serializeRecaptureDiagnostics,
} from '../../core/recapture-diagnostics-view';

describe('recapture diagnostics view helpers', () => {
  it('formats diagnostic labels for compact surfaces', () => {
    expect(recaptureDiagnosticEventLabel({ event: 'content_recapture_failed' })).toBe('Page unreachable');
    expect(recaptureDiagnosticEventLabel({ event: 'tab_activation_completed' })).toBe('Tab opened');
    expect(recaptureDiagnosticLevelLabel('warning')).toBe('Warning');
    expect(recaptureDiagnosticLevelLabel('debug')).toBe('Debug');
  });

  it('passes through invalid diagnostic timestamps', () => {
    expect(formatDiagnosticTime('not-a-date')).toBe('not-a-date');
  });

  it('serializes bounded recapture diagnostics for bug reports', () => {
    const entries = [
      {
        id: 1,
        event: 'content_recapture_failed' as const,
        level: 'error' as const,
        sessionId: 'session-1',
        tabId: 12,
        status: 'unavailable' as const,
        outcome: 'recapture_failed' as const,
        reason: 'content_script_unavailable',
        message: 'Content script was unavailable during recapture.',
        at: '2026-01-01T00:00:00.000Z',
      },
    ];

    expect(createRecaptureDiagnosticsReport(entries, '2026-01-01T00:00:01.000Z')).toEqual({
      kind: RECAPTURE_DIAGNOSTICS_REPORT_KIND,
      exportedAt: '2026-01-01T00:00:01.000Z',
      summary: {
        lastUpdatedAt: '2026-01-01T00:00:00.000Z',
        entryCount: 1,
        currentTarget: undefined,
        latestAttempt: {
          event: 'content_recapture_failed',
          sessionId: 'session-1',
          tabId: 12,
          status: 'unavailable',
          outcome: 'recapture_failed',
          reason: 'content_script_unavailable',
          message: 'Content script was unavailable during recapture.',
          at: '2026-01-01T00:00:00.000Z',
        },
        latestOutcome: {
          event: 'content_recapture_failed',
          sessionId: 'session-1',
          tabId: 12,
          status: 'unavailable',
          outcome: 'recapture_failed',
          reason: 'content_script_unavailable',
          message: 'Content script was unavailable during recapture.',
          at: '2026-01-01T00:00:00.000Z',
        },
      },
      entries,
    });
    expect(serializeRecaptureDiagnostics(entries, '2026-01-01T00:00:01.000Z')).toContain(`"kind": "${RECAPTURE_DIAGNOSTICS_REPORT_KIND}"`);
    expect(serializeRecaptureDiagnostics(entries, '2026-01-01T00:00:01.000Z')).not.toContain('selectedText');
  });

  it('defines a read-only desktop-extension diagnostics bridge contract', () => {
    const entries = [
      {
        id: 2,
        event: 'content_recapture_completed',
        level: 'info',
        sessionId: 'session-2',
        tabId: 44,
        status: 'needs_focus',
        outcome: 'needs_focused_compose',
        reason: 'no_focused_compose',
        message: 'Focus a compose field and retry.',
        at: '2026-01-01T00:00:00.000Z',
        selectedText: 'private page text',
      },
    ];

    const result = createRecaptureDiagnosticsBridgeSuccess(entries, '2026-01-01T00:00:01.000Z');

    expect(result).toEqual({
      ok: true,
      protocol: DESKTOP_EXTENSION_DIAGNOSTICS_BRIDGE_PROTOCOL,
      report: {
        kind: RECAPTURE_DIAGNOSTICS_REPORT_KIND,
        exportedAt: '2026-01-01T00:00:01.000Z',
        summary: {
          lastUpdatedAt: '2026-01-01T00:00:00.000Z',
          entryCount: 1,
          currentTarget: undefined,
          latestAttempt: {
            event: 'content_recapture_completed',
            sessionId: 'session-2',
            tabId: 44,
            status: 'needs_focus',
            outcome: 'needs_focused_compose',
            reason: 'no_focused_compose',
            message: 'Focus a compose field and retry.',
            at: '2026-01-01T00:00:00.000Z',
          },
          latestOutcome: {
            event: 'content_recapture_completed',
            sessionId: 'session-2',
            tabId: 44,
            status: 'needs_focus',
            outcome: 'needs_focused_compose',
            reason: 'no_focused_compose',
            message: 'Focus a compose field and retry.',
            at: '2026-01-01T00:00:00.000Z',
          },
        },
        entries: [
          {
            id: 2,
            event: 'content_recapture_completed',
            level: 'info',
            sessionId: 'session-2',
            tabId: 44,
            status: 'needs_focus',
            outcome: 'needs_focused_compose',
            reason: 'no_focused_compose',
            message: 'Focus a compose field and retry.',
            at: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    });
    expect(Object.keys(result.ok ? result.report.entries[0] : {})).toEqual([...RECAPTURE_DIAGNOSTICS_REPORT_FIELDS]);
    expect(serializeRecaptureDiagnosticsReport(result.ok ? result.report : createRecaptureDiagnosticsReport([]))).not.toContain('selectedText');
  });

  it('defines typed bridge failure results without exposing browser state', () => {
    expect(createRecaptureDiagnosticsBridgeFailure(
      'transport_unavailable',
      'No desktop-extension diagnostics transport is configured.',
      false,
    )).toEqual({
      ok: false,
      protocol: DESKTOP_EXTENSION_DIAGNOSTICS_BRIDGE_PROTOCOL,
      error: {
        code: 'transport_unavailable',
        message: 'No desktop-extension diagnostics transport is configured.',
        retryable: false,
      },
    });
  });
});
