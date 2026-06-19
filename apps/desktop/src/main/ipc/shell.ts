import { ipcMain, shell } from 'electron';

import { fail, ok, type CommandStatus } from './settings.js';

const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download';
const EXTENSION_HELP_URL = 'https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked';

export function registerShellIpc() {
  ipcMain.handle('draftlet:open-ollama-install-page', () => openOllamaInstallPage());
  ipcMain.handle('draftlet:open-extension-help', () => openExtensionHelp());
}

async function openOllamaInstallPage(): Promise<CommandStatus> {
  try {
    await shell.openExternal(OLLAMA_DOWNLOAD_URL);
    return ok('Opened the official Ollama download page.');
  } catch (error) {
    return fail(`Could not open Ollama download page: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function openExtensionHelp(): Promise<CommandStatus> {
  try {
    await shell.openExternal(EXTENSION_HELP_URL);
    return ok('Opened Chrome extension loading instructions. Build Draftlet, load apps/extension/.output/chrome-mv3 as unpacked, then reload the page you are drafting on.');
  } catch (error) {
    return fail(`Could not open extension help: ${error instanceof Error ? error.message : String(error)}`);
  }
}
