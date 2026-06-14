import { checkServerHealth } from '../runtime-api';
import type { RuntimeStatusResult } from '../messages';
import { retryPendingRecaptureDiagnosticsPublish } from './diagnostics-coordinator';

export async function handleGetRuntimeStatus(): Promise<RuntimeStatusResult> {
  const connected = await checkServerHealth();
  if (connected) {
    void retryPendingRecaptureDiagnosticsPublish('runtime_status_recovered');
  }
  return { status: connected ? 'connected' : 'disconnected' };
}
