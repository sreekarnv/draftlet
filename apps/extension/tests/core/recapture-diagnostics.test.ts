import { describe, expect, it } from 'vitest';

import { buildRecaptureDiagnosticsReportSummary, createRecaptureDiagnosticsLog } from '../../core/recapture-diagnostics';

describe('recapture diagnostics log', () => {
  it('keeps a bounded list of recent recapture diagnostics', () => {
    const log = createRecaptureDiagnosticsLog({
      maxEntries: 2,
      now: sequenceClock([
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:01.000Z',
        '2026-01-01T00:00:02.000Z',
      ]),
    });

    log.append({
      event: 'recapture_requested',
      level: 'info',
      sessionId: 'session-a',
      message: 'Recapture requested.',
    });
    log.append({
      event: 'content_recapture_requested',
      level: 'debug',
      sessionId: 'session-a',
      tabId: 10,
      message: 'Sent recapture request to content script.',
    });
    log.append({
      event: 'content_recapture_completed',
      level: 'warning',
      sessionId: 'session-a',
      tabId: 10,
      status: 'needs_focus',
      outcome: 'needs_focused_compose_target',
      message: 'Focus required.',
    });

    expect(log.list().map((entry) => entry.event)).toEqual([
      'content_recapture_requested',
      'content_recapture_completed',
    ]);
    expect(log.list()[1]).toMatchObject({
      id: 3,
      status: 'needs_focus',
      outcome: 'needs_focused_compose_target',
      at: '2026-01-01T00:00:02.000Z',
    });
  });

  it('filters diagnostics by session and limit', () => {
    const log = createRecaptureDiagnosticsLog({ maxEntries: 5 });

    log.append({ event: 'recapture_requested', level: 'info', sessionId: 'session-a', message: 'A1' });
    log.append({ event: 'tab_activation_requested', level: 'info', sessionId: 'session-b', message: 'B1' });
    log.append({ event: 'content_recapture_failed', level: 'error', sessionId: 'session-a', message: 'A2' });

    expect(log.list({ sessionId: 'session-a', limit: 1 }).map((entry) => entry.message)).toEqual(['A2']);
  });

  it('builds a bounded report summary with current target and latest outcome', () => {
    const entries = [
      {
        id: 1,
        event: 'target_revalidation_requested' as const,
        level: 'debug' as const,
        sessionId: 'session-a',
        message: 'Insertion target revalidation requested.',
        at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 2,
        event: 'target_revalidation_completed' as const,
        level: 'warning' as const,
        sessionId: 'session-a',
        tabId: 42,
        status: 'needs_focus' as const,
        reason: 'no_focused_compose_target',
        message: 'Focus a compose field before inserting.',
        at: '2026-01-01T00:00:01.000Z',
      },
    ];

    const summary = buildRecaptureDiagnosticsReportSummary({
      entries,
      currentTarget: {
        sessionId: 'session-a',
        tabId: 42,
        status: 'needs_focus',
        reason: 'no_focused_compose_target',
        message: 'A compose field must be focused before recapture can complete.',
        updatedAt: '2026-01-01T00:00:02.000Z',
      },
      exportedAt: '2026-01-01T00:00:03.000Z',
    });

    expect(summary).toMatchObject({
      lastUpdatedAt: '2026-01-01T00:00:02.000Z',
      entryCount: 2,
      currentTarget: {
        status: 'needs_focus',
      },
      latestAttempt: {
        event: 'target_revalidation_completed',
      },
      latestOutcome: {
        status: 'needs_focus',
      },
    });
  });
});

function sequenceClock(values: string[]) {
  let index = 0;

  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return new Date(value);
  };
}
