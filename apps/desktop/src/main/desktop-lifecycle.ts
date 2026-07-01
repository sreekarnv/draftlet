import type { CommandStatus } from './ipc/settings.js';

export type DesktopStartupMode = 'setup-window' | 'tray-only';

export function getDesktopStartupMode(setupComplete: boolean): DesktopStartupMode {
  return setupComplete ? 'tray-only' : 'setup-window';
}

export function getTrayRuntimeStatusLabel(status: CommandStatus): string {
  const code = status.code ?? 'unknown';

  if (status.ok) {
    if (code === 'starting') {
      return 'Runtime: starting';
    }

    return 'Runtime: ready';
  }

  if (code === 'offline') {
    return 'Runtime: offline';
  }

  if (code === 'conflict') {
    return 'Runtime: port conflict';
  }

  if (code === 'stopped') {
    return 'Runtime: stopped';
  }

  if (code === 'error') {
    return 'Runtime: error';
  }

  return 'Runtime: unknown';
}

export function getTrayTooltip(status: CommandStatus): string {
  return `Draftlet - ${getTrayRuntimeStatusLabel(status).replace('Runtime: ', '')}`;
}
