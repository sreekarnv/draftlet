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
  entries: RecaptureDiagnosticsReportEntry[];
}

export interface BrowserRecaptureDiagnosticsRelayState {
  report: RecaptureDiagnosticsReport | null;
  receivedAt?: string;
  stale: boolean;
  staleAfterSeconds: number;
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
    }
  | {
      ok: false;
      protocol: DesktopExtensionDiagnosticsBridgeProtocol;
      receivedAt?: string;
      stale?: boolean;
      staleAfterSeconds?: number;
      error: {
        code: 'transport_unavailable' | 'extension_unavailable' | 'diagnostics_unavailable' | 'invalid_request';
        message: string;
        retryable: boolean;
      };
    };

export function createRecaptureDiagnosticsReport(
  entries: RecaptureDiagnosticsReportEntry[],
  exportedAt = new Date().toISOString(),
): RecaptureDiagnosticsReport {
  return {
    kind: RECAPTURE_DIAGNOSTICS_REPORT_KIND,
    exportedAt,
    entries: entries.map((entry) => ({
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
    })),
  };
}

export function createRecaptureDiagnosticsBridgeSuccess(
  entries: RecaptureDiagnosticsReportEntry[],
  exportedAt = new Date().toISOString(),
  metadata: {
    receivedAt?: string;
    stale?: boolean;
    staleAfterSeconds?: number;
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
