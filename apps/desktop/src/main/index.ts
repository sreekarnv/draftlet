import path from 'node:path';
import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron';
import started from 'electron-squirrel-startup';

import { registerHealthIpc } from './ipc/health.js';
import { registerOllamaIpc } from './ipc/ollama.js';
import { registerServerIpc, startDraftletServer, stopDraftletServer, stopOwnedDraftletServer } from './ipc/server.js';
import { registerShellIpc } from './ipc/shell.js';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showMainWindow();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
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

  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    return mainWindow;
  }

  void mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  return mainWindow;
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray) {
    return;
  }

  tray = new Tray(createTrayIcon());
  tray.setToolTip('Draftlet');
  tray.setContextMenu(createTrayMenu());
  tray.on('click', showMainWindow);
}

function createTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Open Draftlet', click: showMainWindow },
    { type: 'separator' },
    { label: 'Start server', click: () => void startDraftletServer() },
    { label: 'Stop server', click: () => void stopDraftletServer() },
    { label: 'Restart server', click: () => void restartDraftletServer() },
    { type: 'separator' },
    { label: 'Quit', click: () => void quitApp() },
  ]);
}

function createTrayIcon() {
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAoUlEQVR42u3XMQ6AIAyF4XcDR+/gdT2TF3Fy9AJGw0DCgKVgW2rCwPx/ISIF07zcPRcG4PeA/Tj7AUI8LnNAGv+CgFS8FQHJeAsC0vFaBDTiNQhoxbkIaMY5CGjHSwhYxCmE3x1w8Q24OAUu/gMu/oQtd8G6Xf1uwxCPy3weSOMlhPhElItTCNGZkIq/IcSnYvMd4CLM3wXqp4CLGE8z94AHk5akue+a2HIAAAAASUVORK5CYII=');
  icon.setTemplateImage(process.platform === 'darwin');
  return icon;
}

async function restartDraftletServer() {
  await stopDraftletServer();
  await startDraftletServer();
}

async function quitApp() {
  if (isQuitting) {
    return;
  }

  isQuitting = true;
  await stopOwnedDraftletServer();
  destroyTray();
  app.quit();
}

function destroyTray() {
  tray?.destroy();
  tray = null;
}

app.whenReady().then(() => {
  registerHealthIpc();
  registerOllamaIpc();
  registerServerIpc();
  registerShellIpc();

  createTray();
  createWindow();

  app.on('activate', showMainWindow);
});

app.on('before-quit', (event) => {
  if (isQuitting) {
    destroyTray();
    return;
  }

  event.preventDefault();
  void quitApp();
});

app.on('will-quit', destroyTray);

app.on('window-all-closed', () => {
  // Keep Draftlet available from the tray after the main window is hidden.
});
