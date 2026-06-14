import { SERVER_BASE_URL } from '../constants';
import type { RecaptureDiagnosticsReport } from '@draftlet/shared/contracts';
import { putJson } from './transport';

export async function publishBrowserRecaptureDiagnosticsReport(report: RecaptureDiagnosticsReport): Promise<RecaptureDiagnosticsReport> {
  return putJson<RecaptureDiagnosticsReport>(`${SERVER_BASE_URL}/diagnostics/browser-recapture`, report);
}
