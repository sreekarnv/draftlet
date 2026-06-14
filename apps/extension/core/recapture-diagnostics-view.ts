import {
  createRecaptureDiagnosticsReport as createSharedRecaptureDiagnosticsReport,
  serializeRecaptureDiagnosticsReport,
  type RecaptureDiagnosticsReport,
  type RecaptureDiagnosticsReportSummary,
} from '../../../shared/recapture-diagnostics-contract';
import type { RecaptureDiagnosticEntry, RecaptureDiagnosticLevel } from './messages';

export type { RecaptureDiagnosticsReport } from '../../../shared/recapture-diagnostics-contract';

export function createRecaptureDiagnosticsReport(
  entries: RecaptureDiagnosticEntry[],
  exportedAt = new Date().toISOString(),
  summary?: Partial<RecaptureDiagnosticsReportSummary>,
): RecaptureDiagnosticsReport {
  return createSharedRecaptureDiagnosticsReport(entries, exportedAt, summary);
}

export function serializeRecaptureDiagnostics(
  entries: RecaptureDiagnosticEntry[],
  exportedAt = new Date().toISOString(),
): string {
  return serializeRecaptureDiagnosticsReport(createRecaptureDiagnosticsReport(entries, exportedAt));
}

export function recaptureDiagnosticEventLabel(entry: Pick<RecaptureDiagnosticEntry, 'event'>): string {
  if (entry.event === 'recapture_requested') {
    return 'Recapture requested';
  }

  if (entry.event === 'restore_state_projected') {
    return 'Restore state';
  }

  if (entry.event === 'target_revalidation_requested') {
    return 'Target check requested';
  }

  if (entry.event === 'target_revalidation_completed') {
    return 'Target check returned';
  }

  if (entry.event === 'target_revalidation_failed') {
    return 'Target check failed';
  }

  if (entry.event === 'tab_resolution_ambiguous') {
    return 'Tab choice needed';
  }

  if (entry.event === 'tab_resolution_missing') {
    return 'Tab unavailable';
  }

  if (entry.event === 'content_recapture_requested') {
    return 'Page recapture requested';
  }

  if (entry.event === 'content_recapture_completed') {
    return 'Page recapture returned';
  }

  if (entry.event === 'content_recapture_failed') {
    return 'Page unreachable';
  }

  if (entry.event === 'tab_activation_requested') {
    return 'Open tab requested';
  }

  if (entry.event === 'tab_activation_completed') {
    return 'Tab opened';
  }

  return 'Tab open failed';
}

export function recaptureDiagnosticLevelLabel(level: RecaptureDiagnosticLevel): string {
  if (level === 'error') {
    return 'Error';
  }

  if (level === 'warning') {
    return 'Warning';
  }

  if (level === 'info') {
    return 'Info';
  }

  return 'Debug';
}

export function formatDiagnosticTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
