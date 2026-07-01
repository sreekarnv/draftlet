import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

export const DRAFTLET_SERVER_PORT = 47632;
export const SERVER_BASE_URL = `http://127.0.0.1:${DRAFTLET_SERVER_PORT}`;
export const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
export const RECOMMENDED_MODEL = 'gemma3:4b';
export const POWER_USER_MODEL = 'qwen2.5:7b';
export const LOW_END_FALLBACK_MODEL = 'llama3.2:3b';
export const SERVER_MODEL_PREFERENCE_SCOPE = 'server';
export const SERVER_MODEL_PREFERENCE_KEY = 'default_model';

export type CommandStatusCode =
  | 'ready'
  | 'missing'
  | 'not_running'
  | 'offline'
  | 'starting'
  | 'stopped'
  | 'conflict'
  | 'error'
  | 'unknown';

export interface CommandStatus {
  ok: boolean;
  message: string;
  code?: CommandStatusCode;
}

interface DesktopSettings {
  selectedModel?: string;
}

export function ok(message: string, code: CommandStatusCode = 'ready'): CommandStatus {
  return { ok: true, message, code };
}

export function fail(message: string, code: CommandStatusCode = 'error'): CommandStatus {
  return { ok: false, message, code };
}

export async function getSelectedModelSetting(): Promise<string | null> {
  const settings = await readDesktopSettings();
  return settings.selectedModel?.trim() || null;
}

export async function setSelectedModelSetting(model: string): Promise<void> {
  const selectedModel = model.trim();

  if (!selectedModel) {
    throw new Error('Model name cannot be empty.');
  }

  await writeDesktopSettings({
    ...(await readDesktopSettings()),
    selectedModel,
  });
}

async function readDesktopSettings(): Promise<DesktopSettings> {
  try {
    return JSON.parse(await readFile(getSettingsPath(), 'utf8')) as DesktopSettings;
  } catch {
    return {};
  }
}

async function writeDesktopSettings(settings: DesktopSettings): Promise<void> {
  const settingsPath = getSettingsPath();
  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}
