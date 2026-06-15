export const RECAPTURE_DIAGNOSTICS_REPORT_KIND = 'draftlet.recapture-diagnostics';
export const DESKTOP_EXTENSION_DIAGNOSTICS_BRIDGE_PROTOCOL = 'draftlet.desktop-extension-diagnostics.v1';
export const BROWSER_RECAPTURE_DIAGNOSTICS_STALE_AFTER_SECONDS = 15 * 60;

export const RECAPTURE_DIAGNOSTICS_REPORT_FIELDS = [
  'id',
  'event',
  'level',
  'sessionId',
  'tabId',
  'status',
  'outcome',
  'reason',
  'message',
  'at',
] as const;

export type RecaptureDiagnosticsReportKind = typeof RECAPTURE_DIAGNOSTICS_REPORT_KIND;
export type DesktopExtensionDiagnosticsBridgeProtocol = typeof DESKTOP_EXTENSION_DIAGNOSTICS_BRIDGE_PROTOCOL;
export type RecaptureDiagnosticsReportField = (typeof RECAPTURE_DIAGNOSTICS_REPORT_FIELDS)[number];
export type BrowserRecaptureTargetStatus =
  | 'live'
  | 'stale'
  | 'unavailable'
  | 'needs_recapture'
  | 'needs_focus'
  | 'tab_disambiguation_required'
  | string;

export type RecaptureDiagnosticsReportEntry = {
  [Field in RecaptureDiagnosticsReportField]?: Field extends 'id' | 'tabId' ? number : string;
} & {
  id: number;
  event: string;
  level: string;
  sessionId: string;
  message: string;
  at: string;
};

export interface RecaptureDiagnosticsReport {
  kind: RecaptureDiagnosticsReportKind;
  exportedAt: string;
  summary: RecaptureDiagnosticsReportSummary;
  entries: RecaptureDiagnosticsReportEntry[];
}

export interface RecaptureDiagnosticsReportSummary {
  lastUpdatedAt: string;
  entryCount: number;
  currentTarget?: BrowserRecaptureTargetSummary;
  latestAttempt?: BrowserRecaptureAttemptSummary;
  latestOutcome?: BrowserRecaptureAttemptSummary;
}

export interface BrowserRecaptureTargetSummary {
  sessionId: string;
  tabId?: number;
  status: BrowserRecaptureTargetStatus;
  reason?: string;
  message?: string;
  updatedAt: string;
  candidateCount?: number;
}

export interface BrowserRecaptureAttemptSummary {
  event: string;
  sessionId: string;
  tabId?: number;
  status?: string;
  outcome?: string;
  reason?: string;
  message: string;
  at: string;
}

export interface BrowserRecaptureDiagnosticsRelayState {
  report: RecaptureDiagnosticsReport | null;
  receivedAt?: string;
  stale: boolean;
  staleAfterSeconds: number;
  retentionDays?: number;
  maxStoredReports?: number;
  maxEntriesPerReport?: number;
}

export interface DesktopExtensionDiagnosticsBridgeRequest {
  protocol: DesktopExtensionDiagnosticsBridgeProtocol;
  type: 'draftlet:get-browser-recapture-diagnostics-report';
  sessionId?: string;
  limit?: number;
}

export type DesktopExtensionDiagnosticsBridgeResult =
  | {
      ok: true;
      protocol: DesktopExtensionDiagnosticsBridgeProtocol;
      report: RecaptureDiagnosticsReport;
      receivedAt?: string;
      stale?: boolean;
      staleAfterSeconds?: number;
      retentionDays?: number;
      maxStoredReports?: number;
      maxEntriesPerReport?: number;
    }
  | {
      ok: false;
      protocol: DesktopExtensionDiagnosticsBridgeProtocol;
      receivedAt?: string;
      stale?: boolean;
      staleAfterSeconds?: number;
      retentionDays?: number;
      maxStoredReports?: number;
      maxEntriesPerReport?: number;
      error: {
        code:
          | 'transport_unavailable'
          | 'extension_unavailable'
          | 'diagnostics_unavailable'
          | 'report_not_published'
          | 'report_expired'
          | 'invalid_request';
        message: string;
        retryable: boolean;
      };
    };

export function createRecaptureDiagnosticsReport(
  entries: RecaptureDiagnosticsReportEntry[],
  exportedAt = new Date().toISOString(),
  summary?: Partial<RecaptureDiagnosticsReportSummary>,
): RecaptureDiagnosticsReport {
  const boundedEntries = entries.map((entry) => ({
    id: entry.id,
    event: entry.event,
    level: entry.level,
    sessionId: entry.sessionId,
    tabId: entry.tabId,
    status: entry.status,
    outcome: entry.outcome,
    reason: entry.reason,
    message: entry.message,
    at: entry.at,
  }));
  const latestAttempt = latestAttemptSummary(boundedEntries.at(-1));
  const latestOutcome = latestAttemptSummary([...boundedEntries].reverse().find((entry) => entry.status || entry.outcome || entry.reason));

  return {
    kind: RECAPTURE_DIAGNOSTICS_REPORT_KIND,
    exportedAt,
    summary: {
      lastUpdatedAt: summary?.lastUpdatedAt ?? latestAttempt?.at ?? exportedAt,
      entryCount: summary?.entryCount ?? boundedEntries.length,
      currentTarget: summary?.currentTarget,
      latestAttempt: summary?.latestAttempt ?? latestAttempt,
      latestOutcome: summary?.latestOutcome ?? latestOutcome,
    },
    entries: boundedEntries,
  };
}

export function createRecaptureDiagnosticsBridgeSuccess(
  entries: RecaptureDiagnosticsReportEntry[],
  exportedAt = new Date().toISOString(),
  metadata: {
    receivedAt?: string;
    stale?: boolean;
    staleAfterSeconds?: number;
    retentionDays?: number;
    maxStoredReports?: number;
    maxEntriesPerReport?: number;
  } = {},
): DesktopExtensionDiagnosticsBridgeResult {
  return {
    ok: true,
    protocol: DESKTOP_EXTENSION_DIAGNOSTICS_BRIDGE_PROTOCOL,
    report: createRecaptureDiagnosticsReport(entries, exportedAt),
    ...metadata,
  };
}

export function createRecaptureDiagnosticsBridgeFailure(
  code: Extract<DesktopExtensionDiagnosticsBridgeResult, { ok: false }>['error']['code'],
  message: string,
  retryable: boolean,
  metadata: {
    receivedAt?: string;
    stale?: boolean;
    staleAfterSeconds?: number;
    retentionDays?: number;
    maxStoredReports?: number;
    maxEntriesPerReport?: number;
  } = {},
): DesktopExtensionDiagnosticsBridgeResult {
  return {
    ok: false,
    protocol: DESKTOP_EXTENSION_DIAGNOSTICS_BRIDGE_PROTOCOL,
    ...metadata,
    error: {
      code,
      message,
      retryable,
    },
  };
}

export function serializeRecaptureDiagnosticsReport(report: RecaptureDiagnosticsReport): string {
  return JSON.stringify(report, null, 2);
}

function latestAttemptSummary(entry?: RecaptureDiagnosticsReportEntry): BrowserRecaptureAttemptSummary | undefined {
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
