import {
  DESKTOP_EXTENSION_DIAGNOSTICS_BRIDGE_PROTOCOL,
  createRecaptureDiagnosticsBridgeFailure,
  type BrowserRecaptureTargetSummary,
} from '@draftlet/shared/contracts';
import { publishBrowserRecaptureDiagnosticsReport } from '../runtime-api';
import type {
  PublishRecaptureDiagnosticsReportResult,
  RecaptureDiagnosticEntry,
  RecaptureDiagnosticsResult,
} from '../messages';
import { buildRecaptureDiagnosticsReportSummary } from '../recapture-diagnostics';
import { createRecaptureDiagnosticsReport } from '../recapture-diagnostics-view';
import type { InsertionTargetStatus } from '../types';
import { publishRetryInFlight, recaptureDiagnostics, recaptureDiagnosticsPublishRetry, sessions } from './state';

export function handleGetRecaptureDiagnostics(sessionId?: string, limit = 50): RecaptureDiagnosticsResult {
  return {
    entries: recaptureDiagnostics.list({ sessionId, limit }),
    publish: recaptureDiagnosticsPublishRetry.getState({
      inFlight: publishRetryInFlight.value,
    }),
  };
}

export async function handlePublishRecaptureDiagnosticsReport(
  sessionId?: string,
  limit = 50,
): Promise<PublishRecaptureDiagnosticsReportResult> {
  return publishLatestRecaptureDiagnosticsReport(sessionId, limit);
}

export function recordRecaptureDiagnostic(input: Omit<RecaptureDiagnosticEntry, 'id' | 'at'>): RecaptureDiagnosticEntry {
  const entry = recaptureDiagnostics.append(input);
  console.debug('[Draftlet recapture]', {
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
  });
  void publishLatestRecaptureDiagnosticsReport(entry.sessionId);
  return entry;
}

export function reasonForInsertionTargetStatus(status: InsertionTargetStatus): string | undefined {
  if (status === 'stale') {
    return 'target_stale';
  }

  if (status === 'unavailable') {
    return 'content_script_unavailable';
  }

  if (status === 'needs_focus') {
    return 'no_focused_compose_target';
  }

  if (status === 'tab_disambiguation_required') {
    return 'tab_disambiguation_required';
  }

  if (status === 'needs_recapture') {
    return 'no_focused_compose_target';
  }

  return undefined;
}

export function currentTargetSummary(sessionId: string): BrowserRecaptureTargetSummary | undefined {
  const session = sessions.getBySessionId(sessionId);

  if (!session) {
    return undefined;
  }

  const status = session.insertionTargetStatus ?? (session.insertionTarget ? 'stale' : 'needs_recapture');

  return {
    sessionId: session.sessionId,
    tabId: session.tabId >= 0 ? session.tabId : undefined,
    status,
    reason: reasonForInsertionTargetStatus(status),
    message: currentTargetSummaryMessage(status, session.plausibleTabs?.length),
    updatedAt: session.updatedAt,
    candidateCount: session.plausibleTabs?.length,
  };
}

export function currentTargetSummaryMessage(status: InsertionTargetStatus, candidateCount?: number): string {
  if (status === 'live') {
    return 'Insertion target is live.';
  }

  if (status === 'stale') {
    return 'Saved insertion target is stale and needs recapture.';
  }

  if (status === 'unavailable') {
    return 'Insertion target page is unavailable.';
  }

  if (status === 'needs_focus') {
    return 'A compose field must be focused before recapture can complete.';
  }

  if (status === 'tab_disambiguation_required') {
    return candidateCount
      ? `Choose one of ${candidateCount} plausible tabs before recapture.`
      : 'Choose the tab with the compose field before recapture.';
  }

  return 'Insertion target needs recapture.';
}

export function browserDiagnosticsPublishFailureMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not publish browser recapture diagnostics.';
}

export async function publishLatestRecaptureDiagnosticsReport(
  sessionId?: string,
  limit = 50,
): Promise<PublishRecaptureDiagnosticsReportResult> {
  const exportedAt = new Date().toISOString();
  const entries = recaptureDiagnostics.list({ sessionId, limit });
  const reportSessionId = sessionId ?? entries.at(-1)?.sessionId;
  const summary = buildRecaptureDiagnosticsReportSummary({
    entries,
    currentTarget: reportSessionId ? currentTargetSummary(reportSessionId) : undefined,
    exportedAt,
  });
  const report = createRecaptureDiagnosticsReport(entries, exportedAt, summary);

  try {
    const published = await publishBrowserRecaptureDiagnosticsReport(report);
    recaptureDiagnosticsPublishRetry.recordSuccess(published);

    return {
      ok: true,
      protocol: DESKTOP_EXTENSION_DIAGNOSTICS_BRIDGE_PROTOCOL,
      report: published,
    };
  } catch (error) {
    const message = browserDiagnosticsPublishFailureMessage(error);
    recaptureDiagnosticsPublishRetry.recordFailure(report, message);

    return createRecaptureDiagnosticsBridgeFailure(
      'diagnostics_unavailable',
      message,
      true,
    );
  }
}

export async function retryPendingRecaptureDiagnosticsPublish(trigger: string): Promise<void> {
  if (publishRetryInFlight.value) {
    return;
  }

  const report = recaptureDiagnosticsPublishRetry.nextPendingReport();

  if (!report) {
    return;
  }

  publishRetryInFlight.value = true;

  try {
    const published = await publishBrowserRecaptureDiagnosticsReport(report);
    recaptureDiagnosticsPublishRetry.recordSuccess(published);
    console.debug('[Draftlet recapture]', {
      event: 'browser_diagnostics_publish_retry_completed',
      trigger,
      exportedAt: report.exportedAt,
      entryCount: report.entries.length,
    });
  } catch (error) {
    const message = browserDiagnosticsPublishFailureMessage(error);
    recaptureDiagnosticsPublishRetry.recordFailure(report, message);
    console.debug('[Draftlet recapture]', {
      event: 'browser_diagnostics_publish_retry_failed',
      trigger,
      exportedAt: report.exportedAt,
      entryCount: report.entries.length,
      message,
    });
  } finally {
    publishRetryInFlight.value = false;
  }
}
