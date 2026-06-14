import type { RecaptureDiagnosticsReport } from '../../../shared/recapture-diagnostics-contract';

export interface BrowserDiagnosticsPublishReliabilityState {
  queued: boolean;
  retryPending: boolean;
  inFlight: boolean;
  retryCount: number;
  maxRetryAttempts: number;
  firstFailedAt?: string;
  lastFailedAt?: string;
  lastFailureReason?: string;
  pendingReportExportedAt?: string;
  pendingEntryCount?: number;
  expiresAt?: string;
}

interface PendingDiagnosticsPublish {
  report: RecaptureDiagnosticsReport;
  firstFailedAt: string;
  lastFailedAt: string;
  lastFailureReason: string;
  retryCount: number;
}

interface LastDiagnosticsPublishFailure {
  at: string;
  reason: string;
  retryCount: number;
}

interface RecaptureDiagnosticsPublishRetryOptions {
  maxPendingReports?: number;
  maxRetryAttempts?: number;
  retryWindowMs?: number;
  now?: () => Date;
}

interface PublishReliabilityStateOptions {
  inFlight?: boolean;
}

export interface RecaptureDiagnosticsPublishRetryQueue {
  recordFailure(report: RecaptureDiagnosticsReport, reason: string): void;
  recordSuccess(report: RecaptureDiagnosticsReport): void;
  nextPendingReport(): RecaptureDiagnosticsReport | null;
  getState(options?: PublishReliabilityStateOptions): BrowserDiagnosticsPublishReliabilityState;
  clear(): void;
}

export function createRecaptureDiagnosticsPublishRetryQueue({
  maxPendingReports = 1,
  maxRetryAttempts = 3,
  retryWindowMs = 5 * 60 * 1000,
  now = () => new Date(),
}: RecaptureDiagnosticsPublishRetryOptions = {}): RecaptureDiagnosticsPublishRetryQueue {
  let pending: PendingDiagnosticsPublish[] = [];
  let lastFailure: LastDiagnosticsPublishFailure | undefined;

  function currentTime(): string {
    return now().toISOString();
  }

  function isRetryable(item: PendingDiagnosticsPublish, atMs: number): boolean {
    const firstFailedAt = Date.parse(item.firstFailedAt);

    if (Number.isNaN(firstFailedAt)) {
      return false;
    }

    return item.retryCount < maxRetryAttempts && atMs - firstFailedAt <= retryWindowMs;
  }

  function pruneExpired(atMs = now().getTime()): void {
    pending = pending.filter((item) => isRetryable(item, atMs));
  }

  function upsertPending(report: RecaptureDiagnosticsReport, reason: string): PendingDiagnosticsPublish {
    const failedAt = currentTime();
    const existing = pending.find((item) => item.report.exportedAt === report.exportedAt);
    const nextItem: PendingDiagnosticsPublish = existing
      ? {
          ...existing,
          lastFailedAt: failedAt,
          lastFailureReason: reason,
          retryCount: existing.retryCount + 1,
        }
      : {
          report,
          firstFailedAt: failedAt,
          lastFailedAt: failedAt,
          lastFailureReason: reason,
          retryCount: 0,
        };

    pending = [
      nextItem,
      ...pending.filter((item) => item.report.exportedAt !== report.exportedAt),
    ].slice(0, Math.max(1, maxPendingReports));

    return nextItem;
  }

  function retryExpiresAt(item: PendingDiagnosticsPublish): string {
    return new Date(Date.parse(item.firstFailedAt) + retryWindowMs).toISOString();
  }

  return {
    recordFailure(report, reason) {
      const item = upsertPending(report, reason);
      lastFailure = {
        at: item.lastFailedAt,
        reason,
        retryCount: item.retryCount,
      };
      pruneExpired(Date.parse(item.lastFailedAt));
    },
    recordSuccess() {
      pending = [];
      lastFailure = undefined;
    },
    nextPendingReport() {
      pruneExpired();
      return pending[0]?.report ?? null;
    },
    getState({ inFlight = false } = {}) {
      const atMs = now().getTime();
      pruneExpired(atMs);
      const item = pending[0];

      return {
        queued: Boolean(item),
        retryPending: Boolean(item && isRetryable(item, atMs)),
        inFlight,
        retryCount: item?.retryCount ?? lastFailure?.retryCount ?? 0,
        maxRetryAttempts,
        firstFailedAt: item?.firstFailedAt,
        lastFailedAt: item?.lastFailedAt ?? lastFailure?.at,
        lastFailureReason: item?.lastFailureReason ?? lastFailure?.reason,
        pendingReportExportedAt: item?.report.exportedAt,
        pendingEntryCount: item?.report.entries.length,
        expiresAt: item ? retryExpiresAt(item) : undefined,
      };
    },
    clear() {
      pending = [];
      lastFailure = undefined;
    },
  };
}
