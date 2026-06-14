import { describe, expect, it } from 'vitest';

import { createRecaptureDiagnosticsPublishRetryQueue } from '../../core/recapture-diagnostics-publish-retry';
import { createRecaptureDiagnosticsReport } from '@draftlet/shared/contracts';

describe('recapture diagnostics publish retry queue', () => {
  it('queues a failed report and exposes publish reliability state', () => {
    const queue = createRecaptureDiagnosticsPublishRetryQueue({
      now: fixedClock('2026-01-01T00:00:00.000Z'),
    });
    const report = reportWithExportedAt('2026-01-01T00:00:00.000Z', 'Initial report.');

    queue.recordFailure(report, 'Runtime unavailable.');

    expect(queue.nextPendingReport()).toBe(report);
    expect(queue.getState()).toMatchObject({
      queued: true,
      retryPending: true,
      inFlight: false,
      retryCount: 0,
      maxRetryAttempts: 3,
      firstFailedAt: '2026-01-01T00:00:00.000Z',
      lastFailedAt: '2026-01-01T00:00:00.000Z',
      lastFailureReason: 'Runtime unavailable.',
      pendingReportExportedAt: '2026-01-01T00:00:00.000Z',
      pendingEntryCount: 1,
    });
  });

  it('keeps the newest pending report first within the bounded queue', () => {
    const queue = createRecaptureDiagnosticsPublishRetryQueue({
      maxPendingReports: 1,
      now: sequenceClock([
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:01.000Z',
      ]),
    });
    const first = reportWithExportedAt('2026-01-01T00:00:00.000Z', 'First report.');
    const second = reportWithExportedAt('2026-01-01T00:00:01.000Z', 'Second report.');

    queue.recordFailure(first, 'Runtime unavailable.');
    queue.recordFailure(second, 'Runtime still unavailable.');

    expect(queue.nextPendingReport()).toBe(second);
    expect(queue.getState()).toMatchObject({
      queued: true,
      lastFailureReason: 'Runtime still unavailable.',
      pendingReportExportedAt: '2026-01-01T00:00:01.000Z',
    });
  });

  it('clears queued reports after a successful publish', () => {
    const queue = createRecaptureDiagnosticsPublishRetryQueue({
      now: fixedClock('2026-01-01T00:00:00.000Z'),
    });
    const report = reportWithExportedAt('2026-01-01T00:00:00.000Z', 'Initial report.');

    queue.recordFailure(report, 'Runtime unavailable.');
    queue.recordSuccess(report);

    expect(queue.nextPendingReport()).toBeNull();
    expect(queue.getState()).toMatchObject({
      queued: false,
      retryPending: false,
    });
    expect(queue.getState().lastFailureReason).toBeUndefined();
  });

  it('stops retrying after the retry attempt limit', () => {
    const queue = createRecaptureDiagnosticsPublishRetryQueue({
      maxRetryAttempts: 2,
      now: sequenceClock([
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:01.000Z',
        '2026-01-01T00:00:02.000Z',
      ]),
    });
    const report = reportWithExportedAt('2026-01-01T00:00:00.000Z', 'Initial report.');

    queue.recordFailure(report, 'Initial failure.');
    queue.recordFailure(report, 'First retry failed.');
    queue.recordFailure(report, 'Second retry failed.');

    expect(queue.nextPendingReport()).toBeNull();
    expect(queue.getState()).toMatchObject({
      queued: false,
      retryPending: false,
      retryCount: 2,
      lastFailureReason: 'Second retry failed.',
    });
  });

  it('expires pending reports after the retry window', () => {
    let now = new Date('2026-01-01T00:00:00.000Z');
    const queue = createRecaptureDiagnosticsPublishRetryQueue({
      retryWindowMs: 60_000,
      now: () => now,
    });
    const report = reportWithExportedAt('2026-01-01T00:00:00.000Z', 'Initial report.');

    queue.recordFailure(report, 'Runtime unavailable.');
    now = new Date('2026-01-01T00:02:00.000Z');

    expect(queue.nextPendingReport()).toBeNull();
    expect(queue.getState()).toMatchObject({
      queued: false,
      retryPending: false,
      lastFailureReason: 'Runtime unavailable.',
    });
  });
});

function reportWithExportedAt(exportedAt: string, message: string) {
  return createRecaptureDiagnosticsReport([
    {
      id: 1,
      event: 'restore_state_projected',
      level: 'info',
      sessionId: 'session-a',
      message,
      at: exportedAt,
    },
  ], exportedAt);
}

function fixedClock(value: string) {
  return () => new Date(value);
}

function sequenceClock(values: string[]) {
  let index = 0;

  return () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return new Date(value);
  };
}
