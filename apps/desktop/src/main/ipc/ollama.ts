import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { ipcMain } from 'electron';

import { checkHttpStatus } from './health.js';
import {
  fail,
  getSelectedModelSetting,
  ok,
  RECOMMENDED_MODEL,
  SERVER_BASE_URL,
  SERVER_MODEL_PREFERENCE_KEY,
  SERVER_MODEL_PREFERENCE_SCOPE,
  setSelectedModelSetting,
  type CommandStatus,
} from './settings.js';

const execFileAsync = promisify(execFile);

export interface InstalledModel {
  name: string;
}

export function registerOllamaIpc() {
  ipcMain.handle('draftlet:check-ollama-installed', () => checkOllamaInstalled());
  ipcMain.handle('draftlet:check-ollama-running', () => checkOllamaRunning());
  ipcMain.handle('draftlet:check-recommended-model-installed', () => checkRecommendedModelInstalled());
  ipcMain.handle('draftlet:list-installed-models', () => listInstalledModels());
  ipcMain.handle('draftlet:get-selected-model', () => getSelectedModel());
  ipcMain.handle('draftlet:set-selected-model', (_event, model: string) => setSelectedModel(model));
  ipcMain.handle('draftlet:pull-recommended-model', () => pullRecommendedModel());
}

export async function checkOllamaInstalled(): Promise<CommandStatus> {
  try {
    const { stdout } = await execFileAsync('ollama', ['--version']);
    const version = stdout.trim();
    return ok(version || 'Ollama is installed.', 'ready');
  } catch {
    return fail('Ollama is not installed or is not available on PATH.', 'missing');
  }
}

export async function checkOllamaRunning(): Promise<CommandStatus> {
  const installed = await checkOllamaInstalled();

  if (!installed.ok) {
    return fail('Install Ollama before checking whether it is running.', 'missing');
  }

  const running = await checkHttpStatus('http://127.0.0.1:11434/api/tags', 'Ollama is running.', 'Ollama');

  if (!running.ok) {
    return fail('Ollama is installed but is not running. Start Ollama, then recheck.', 'not_running');
  }

  return running;
}

export async function checkRecommendedModelInstalled(): Promise<CommandStatus> {
  const installed = await checkOllamaInstalled();

  if (!installed.ok) {
    return fail(`Install Ollama before checking ${RECOMMENDED_MODEL}.`, 'missing');
  }

  try {
    const models = await listInstalledModels();
    const modelInstalled = models.some((model) => model.name === RECOMMENDED_MODEL);

    if (modelInstalled) {
      return ok(`${RECOMMENDED_MODEL} is installed.`, 'ready');
    }

    return fail(`${RECOMMENDED_MODEL} is not installed yet.`, 'missing');
  } catch {
    return fail('Could not list Ollama models. Start Ollama, then recheck.', 'not_running');
  }
}

export async function listInstalledModels(): Promise<InstalledModel[]> {
  const { stdout } = await execFileAsync('ollama', ['list']);

  return stdout
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(Boolean)
    .map((name) => ({ name }));
}

export async function getSelectedModel(): Promise<string> {
  const serverModel = await getSelectedModelFromServer();

  if (serverModel) {
    await setSelectedModelSetting(serverModel);
    return serverModel;
  }

  return (await getSelectedModelSetting()) ?? RECOMMENDED_MODEL;
}

export async function setSelectedModel(model: string): Promise<CommandStatus> {
  const selectedModel = model.trim();

  if (!selectedModel) {
    return fail('Select a valid model name.', 'error');
  }

  const installedModels = await listInstalledModels().catch(() => []);

  if (!installedModels.some((installed) => installed.name === selectedModel)) {
    return fail(`${selectedModel} is not installed in Ollama.`, 'missing');
  }

  await setSelectedModelSetting(selectedModel);
  await syncSelectedModelToServer(selectedModel);

  return ok(`${selectedModel} is now the active Draftlet model.`, 'ready');
}

export function pullRecommendedModel(): Promise<CommandStatus> {
  return new Promise((resolve) => {
    const child = spawn('ollama', ['pull', RECOMMENDED_MODEL], { stdio: 'ignore', windowsHide: true });

    child.once('error', () => {
      resolve(fail('Could not start Ollama model pull. Is Ollama installed?', 'missing'));
    });

    child.once('exit', (code) => {
      if (code === 0) {
        resolve(ok(`${RECOMMENDED_MODEL} installed.`, 'ready'));
        return;
      }

      resolve(fail(`ollama pull ${RECOMMENDED_MODEL} exited with code ${code ?? 'unknown'}.`, 'error'));
    });
  });
}

async function getSelectedModelFromServer(): Promise<string | null> {
  try {
    const response = await fetch(`${SERVER_BASE_URL}/preferences?scope=${encodeURIComponent(SERVER_MODEL_PREFERENCE_SCOPE)}`, { cache: 'no-store' });

    if (!response.ok) {
      return null;
    }

    const preferences = await response.json() as Array<{ key?: string; value?: string }>;
    const preference = preferences.find((item) => item.key === SERVER_MODEL_PREFERENCE_KEY);
    return preference?.value?.trim() || null;
  } catch {
    return null;
  }
}

async function syncSelectedModelToServer(model: string): Promise<void> {
  try {
    await fetch(`${SERVER_BASE_URL}/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: SERVER_MODEL_PREFERENCE_SCOPE,
        key: SERVER_MODEL_PREFERENCE_KEY,
        value: model,
      }),
    });
  } catch {
    // The desktop setting is still persisted; the next running server can get it from env on start.
  }
}
