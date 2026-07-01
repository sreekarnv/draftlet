import path from 'node:path';
import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron';
import started from 'electron-squirrel-startup';

import { getDesktopStartupMode, getTrayRuntimeStatusLabel, getTrayTooltip } from './desktop-lifecycle.js';
import { registerDiagnosticsIpc } from './ipc/diagnostics.js';
import { checkServerHealth, registerHealthIpc } from './ipc/health.js';
import { registerOllamaIpc } from './ipc/ollama.js';
import { registerServerIpc, startDraftletServer, stopDraftletServer, stopOwnedDraftletServer } from './ipc/server.js';
import { getSetupCompleteSetting, registerSettingsIpc, type CommandStatus } from './ipc/settings.js';
import { registerShellIpc } from './ipc/shell.js';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let runtimeStatus: CommandStatus = { ok: false, message: 'Runtime status has not been checked yet.', code: 'unknown' };
let runtimeStatusTimer: NodeJS.Timeout | null = null;

type DesktopView = 'settings' | 'diagnostics' | 'runtime' | 'help';

function createWindow(view: DesktopView = 'settings') {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showMainWindow(view);
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
    void mainWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#${view}`);
    return mainWindow;
  }

  void mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), { hash: view });
  return mainWindow;
}

function showMainWindow(view: DesktopView = 'settings') {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow(view);
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('draftlet:desktop-view', view);
}

function createTray() {
  if (tray) {
    return;
  }

  tray = new Tray(createTrayIcon());
  updateTrayStatus(runtimeStatus);
  tray.on('click', () => showMainWindow('settings'));
}

function createTrayMenu() {
  return Menu.buildFromTemplate([
    { label: getTrayRuntimeStatusLabel(runtimeStatus), enabled: false },
    { label: runtimeStatus.message.slice(0, 90), enabled: false },
    { type: 'separator' },
    { label: 'Settings', click: () => showMainWindow('settings') },
    { label: 'Diagnostics', click: () => showMainWindow('diagnostics') },
    { type: 'separator' },
    { label: 'Restart Runtime', click: () => void restartRuntimeFromTray() },
    { label: 'Stop Runtime', click: () => void stopRuntimeFromTray() },
    { type: 'separator' },
    { label: 'Quit', click: () => void quitApp() },
  ]);
}

function updateTrayStatus(status: CommandStatus) {
  runtimeStatus = status;

  if (!tray) {
    return;
  }

  tray.setToolTip(getTrayTooltip(status));
  tray.setContextMenu(createTrayMenu());
}

async function refreshRuntimeStatus() {
  updateTrayStatus(await checkServerHealth());
}

function startRuntimeStatusPolling() {
  if (runtimeStatusTimer) {
    return;
  }

  runtimeStatusTimer = setInterval(() => {
    void refreshRuntimeStatus();
  }, 30000);
}

function stopRuntimeStatusPolling() {
  if (!runtimeStatusTimer) {
    return;
  }

  clearInterval(runtimeStatusTimer);
  runtimeStatusTimer = null;
}

function createTrayIcon() {
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAoUlEQVR42u3XMQ6AIAyF4XcDR+/gdT2TF3Fy9AJGw0DCgKVgW2rCwPx/ISIF07zcPRcG4PeA/Tj7AUI8LnNAGv+CgFS8FQHJeAsC0vFaBDTiNQhoxbkIaMY5CGjHSwhYxCmE3x1w8Q24OAUu/gMu/oQtd8G6Xf1uwxCPy3weSOMlhPhElItTCNGZkIq/IcSnYvMd4CLM3wXqp4CLGE8z94AHk5akue+a2HIAAAAASUVORK5CYII=');
  icon.setTemplateImage(process.platform === 'darwin');
  return icon;
}

async function startRuntimeFromTray() {
  updateTrayStatus({ ok: true, message: 'Draftlet runtime is starting.', code: 'starting' });
  updateTrayStatus(await startDraftletServer());
  setTimeout(() => void refreshRuntimeStatus(), 1500);
}

async function stopRuntimeFromTray() {
  updateTrayStatus(await stopDraftletServer());
  setTimeout(() => void refreshRuntimeStatus(), 500);
}

async function restartRuntimeFromTray() {
  updateTrayStatus({ ok: true, message: 'Draftlet runtime is restarting.', code: 'starting' });
  await stopDraftletServer();
  updateTrayStatus(await startDraftletServer());
  setTimeout(() => void refreshRuntimeStatus(), 1500);
}

async function quitApp() {
  if (isQuitting) {
    return;
  }

  isQuitting = true;
  stopRuntimeStatusPolling();
  await stopOwnedDraftletServer();
  destroyTray();
  app.quit();
}

function destroyTray() {
  tray?.destroy();
  tray = null;
}

app.whenReady().then(async () => {
  registerDiagnosticsIpc();
  registerHealthIpc();
  registerOllamaIpc();
  registerServerIpc();
  registerSettingsIpc();
  registerShellIpc();

  createTray();
  startRuntimeStatusPolling();

  const startupMode = getDesktopStartupMode(await getSetupCompleteSetting());

  if (startupMode === 'setup-window') {
    createWindow('settings');
    void refreshRuntimeStatus();
  } else {
    void startRuntimeFromTray();
  }

  app.on('activate', () => showMainWindow('settings'));
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
