import type {
  RecaptureDiagnosticEntry,
  RecaptureDiagnosticEvent,
  RecaptureDiagnosticLevel,
  RecaptureInsertionTargetFailureReason,
  RecaptureInsertionTargetOutcome,
  WorkspaceRestoreStatus,
} from './messages';
import type { InsertionTargetStatus } from './types';
import type {
  BrowserRecaptureAttemptSummary,
  BrowserRecaptureTargetSummary,
  RecaptureDiagnosticsReportSummary,
} from '../../../shared/recapture-diagnostics-contract';

interface RecaptureDiagnosticsLogOptions {
  maxEntries?: number;
  now?: () => Date;
}

interface AppendRecaptureDiagnosticInput {
  event: RecaptureDiagnosticEvent;
  level: RecaptureDiagnosticLevel;
  sessionId: string;
  tabId?: number;
  status?: InsertionTargetStatus | WorkspaceRestoreStatus;
  outcome?: RecaptureInsertionTargetOutcome;
  reason?: RecaptureInsertionTargetFailureReason | string;
  message: string;
}

interface ListRecaptureDiagnosticsOptions {
  sessionId?: string;
  limit?: number;
}

export interface RecaptureDiagnosticsLog {
  append(input: AppendRecaptureDiagnosticInput): RecaptureDiagnosticEntry;
  list(options?: ListRecaptureDiagnosticsOptions): RecaptureDiagnosticEntry[];
  clear(): void;
}

export interface BuildRecaptureDiagnosticsReportSummaryInput {
  entries: RecaptureDiagnosticEntry[];
  currentTarget?: BrowserRecaptureTargetSummary;
  exportedAt?: string;
}

export function createRecaptureDiagnosticsLog({
  maxEntries = 50,
  now = () => new Date(),
}: RecaptureDiagnosticsLogOptions = {}): RecaptureDiagnosticsLog {
  let entries: RecaptureDiagnosticEntry[] = [];
  let nextId = 1;

  return {
    append(input) {
      const entry: RecaptureDiagnosticEntry = {
        id: nextId,
        event: input.event,
        level: input.level,
        sessionId: input.sessionId,
        tabId: input.tabId,
        status: input.status,
        outcome: input.outcome,
        reason: input.reason,
        message: input.message,
        at: now().toISOString(),
      };
      nextId += 1;
      entries = [...entries, entry].slice(-maxEntries);
      return entry;
    },
    list({ sessionId, limit = maxEntries } = {}) {
      const filtered = sessionId ? entries.filter((entry) => entry.sessionId === sessionId) : entries;
      return filtered.slice(-limit);
    },
    clear() {
      entries = [];
      nextId = 1;
    },
  };
}

export function buildRecaptureDiagnosticsReportSummary({
  entries,
  currentTarget,
  exportedAt = new Date().toISOString(),
}: BuildRecaptureDiagnosticsReportSummaryInput): RecaptureDiagnosticsReportSummary {
  const latestAttempt = entryToAttemptSummary(entries.at(-1));
  const latestOutcome = entryToAttemptSummary([...entries].reverse().find((entry) => entry.status || entry.outcome || entry.reason));

  return {
    lastUpdatedAt: currentTarget?.updatedAt ?? latestAttempt?.at ?? exportedAt,
    entryCount: entries.length,
    currentTarget,
    latestAttempt,
    latestOutcome,
  };
}

function entryToAttemptSummary(entry?: RecaptureDiagnosticEntry): BrowserRecaptureAttemptSummary | undefined {
  if (!entry) {
    return undefined;
  }

  return {
    event: entry.event,
    sessionId: entry.sessionId,
    tabId: entry.tabId,
    status: entry.status,
    outcome: entry.outcome,
    reason: entry.reason,
    message: entry.message,
    at: entry.at,
  };
}
