import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';

import { registerHealthIpc } from './ipc/health.js';
import { registerOllamaIpc } from './ipc/ollama.js';
import { registerServerIpc } from './ipc/server.js';
import { registerShellIpc } from './ipc/shell.js';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

if (started) {
  app.quit();
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 760,
    minHeight: 560,
    title: 'Draftlet',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    return;
  }

  void mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
}

app.whenReady().then(() => {
  registerHealthIpc();
  registerOllamaIpc();
  registerServerIpc();
  registerShellIpc();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
