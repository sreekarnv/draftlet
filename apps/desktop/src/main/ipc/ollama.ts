import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { ipcMain } from 'electron';

import type { CommandStatus, InstalledModel } from '@draftlet/shared/contracts';

import { checkHttpStatus } from './health.js';
import {
  fail,
  getSelectedModelSetting,
  ok,
  RECOMMENDED_MODEL,
  SERVER_BASE_URL,
  setSelectedModelSetting,
} from './settings.js';

const execFileAsync = promisify(execFile);

export type { InstalledModel };

interface RuntimeModelStateRead {
  selected_model?: string;
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
    return fail('Ollama was not found on this machine. Install Ollama, then recheck.', 'missing');
  }
}

export async function checkOllamaRunning(): Promise<CommandStatus> {
  const installed = await checkOllamaInstalled();

  if (!installed.ok) {
    return fail('Ollama was not found on this machine. Install Ollama, then recheck.', 'missing');
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
    return fail('Ollama was not found on this machine. Install Ollama, then recheck.', 'missing');
  }

  try {
    const models = await listInstalledModels();
    const modelInstalled = models.some((model) => model.name === RECOMMENDED_MODEL);

    if (modelInstalled) {
      return ok(`${RECOMMENDED_MODEL} is installed.`, 'ready');
    }

    return fail(`${RECOMMENDED_MODEL} is not available in Ollama yet.`, 'missing');
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

  const installedModels = await listInstalledModels().catch(() => null);

  const modelInstalled = installedModels?.some((installed) => installed.name === selectedModel) ?? false;

  await setSelectedModelSetting(selectedModel);
  await syncSelectedModelToServer(selectedModel);

  if (installedModels && !modelInstalled) {
    return ok(`${selectedModel} is selected. Install it in Ollama before generating with this model.`, 'missing');
  }

  return ok(`${selectedModel} is now the active Draftlet model.`, 'ready');
}

export function pullRecommendedModel(): Promise<CommandStatus> {
  return new Promise((resolve) => {
    const child = spawn('ollama', ['pull', RECOMMENDED_MODEL], { stdio: 'ignore', windowsHide: true });

    child.once('error', () => {
      resolve(fail('Could not start the Ollama model pull. Install Ollama, then recheck.', 'missing'));
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
    const response = await fetch(`${SERVER_BASE_URL}/models/ollama`, { cache: 'no-store' });

    if (!response.ok) {
      return null;
    }

    const state = await response.json() as RuntimeModelStateRead;
    return state.selected_model?.trim() || null;
  } catch {
    return null;
  }
}

async function syncSelectedModelToServer(model: string): Promise<void> {
  try {
    await fetch(`${SERVER_BASE_URL}/models/ollama/selection`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selected_model: model,
      }),
    });
  } catch {
    // The desktop setting is still persisted so setup can show the user's last choice.
  }
}
