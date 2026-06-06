import { ipcMain } from 'electron';

import { fail, ok, SERVER_BASE_URL, type CommandStatus } from './settings.js';

interface DraftletHealthResponse {
  status?: string;
  service?: string;
  app?: string;
  version?: string;
}

export function registerHealthIpc() {
  ipcMain.handle('draftlet:check-server-health', () => checkServerHealth());
}

export async function checkServerHealth(): Promise<CommandStatus> {
  try {
    const response = await fetch(`${SERVER_BASE_URL}/health`, { cache: 'no-store' });

    if (!response.ok) {
      return fail(`Draftlet server responded with HTTP ${response.status}.`, 'error');
    }

    const data = await response.json() as DraftletHealthResponse;

    if (isDraftletHealth(data)) {
      return ok(`Draftlet server is healthy (${data.version ?? 'unknown version'}).`, 'ready');
    }

    return fail('A service responded on the Draftlet port, but it is not Draftlet.', 'conflict');
  } catch (error) {
    return fail(`Draftlet server is not reachable: ${error instanceof Error ? error.message : String(error)}`, 'offline');
  }
}

export async function checkHttpStatus(url: string, healthyMessage: string, label: string): Promise<CommandStatus> {
  try {
    const response = await fetch(url, { cache: 'no-store' });

    if (response.ok) {
      return ok(healthyMessage, 'ready');
    }

    return fail(`${label} responded with HTTP ${response.status}.`, 'error');
  } catch (error) {
    return fail(`${label} is not reachable: ${error instanceof Error ? error.message : String(error)}`, 'not_running');
  }
}

export function isDraftletHealth(data: DraftletHealthResponse): boolean {
  return data.status === 'healthy' && data.service === 'draftlet-server' && data.app === 'draftlet';
}
