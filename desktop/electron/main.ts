import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, net } from "electron";
import { createRequire } from "node:module";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;
let runtime: ChildProcess | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let runtimeEventsAbort: AbortController | null = null;
let runtimeEventsReconnect: ReturnType<typeof setTimeout> | null = null;

const RUN_IN_BACKGROUND_KEY = "run_in_background";
const RUNTIME_BASE_URL = "http://127.0.0.1:8000";
const RUNTIME_EVENTS_URL = "http://127.0.0.1:8000/api/v1/events/stream";
const RUN_IN_BACKGROUND_PATH = `/api/v1/settings/${RUN_IN_BACKGROUND_KEY}`;

type RuntimeRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

type RuntimeEvent = Record<string, unknown> & { type?: string };

function startRuntime() {
  if (!VITE_DEV_SERVER_URL || runtime) return;
  const runtimeRoot = path.resolve(process.env.APP_ROOT, "..", "api");
  runtime = spawn("sh", ["-c", "uv run alembic-upgrade && uv run dev"], {
    cwd: runtimeRoot,
    stdio: "inherit",
  });
  runtime.on("exit", () => {
    runtime = null;
  });
}

function broadcastRuntimeEvent(event: RuntimeEvent) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("runtime:event", event);
  }
}

function scheduleRuntimeEventsReconnect() {
  if (isQuitting || runtimeEventsReconnect) return;
  runtimeEventsReconnect = setTimeout(() => {
    runtimeEventsReconnect = null;
    void connectRuntimeEvents();
  }, 1_000);
}

function handleRuntimeEventChunk(buffer: string) {
  let remaining = buffer;
  let separator = remaining.indexOf("\n\n");
  while (separator >= 0) {
    const rawEvent = remaining.slice(0, separator);
    remaining = remaining.slice(separator + 2);
    const data = rawEvent
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (data) {
      try {
        broadcastRuntimeEvent(JSON.parse(data) as RuntimeEvent);
      } catch {
        // Ignore malformed runtime events; the API controls this stream.
      }
    }
    separator = remaining.indexOf("\n\n");
  }
  return remaining;
}

async function connectRuntimeEvents() {
  if (isQuitting || runtimeEventsAbort) return;

  startRuntime();
  const abort = new AbortController();
  runtimeEventsAbort = abort;
  try {
    console.info("Connecting runtime event stream");
    const response = await net.fetch(RUNTIME_EVENTS_URL, { signal: abort.signal });
    if (!response.ok || !response.body) {
      throw new Error(`Runtime event stream failed (${response.status})`);
    }

    console.info("Runtime event stream connected");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (!isQuitting && !abort.signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer = handleRuntimeEventChunk(buffer + decoder.decode(value, { stream: true }));
    }
  } catch (error) {
    if (!abort.signal.aborted) {
      console.info("Runtime event stream disconnected", error);
    }
  } finally {
    if (runtimeEventsAbort === abort) {
      runtimeEventsAbort = null;
    }
    scheduleRuntimeEventsReconnect();
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runtimeRequest(path: string, init?: RuntimeRequestInit, retries = 0) {
  startRuntime();

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await net.fetch(`${RUNTIME_BASE_URL}${path}`, init);
      const body = await response.text();
      return { ok: response.ok, status: response.status, body };
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }

      await sleep(250);
    }
  }

  throw new Error("Runtime request failed");
}

async function getRunInBackground() {
  try {
    const response = await runtimeRequest(RUN_IN_BACKGROUND_PATH, undefined, 12);
    if (!response.ok) return false;

    const setting = JSON.parse(response.body) as { value?: unknown };
    return setting.value === true;
  } catch {
    return false;
  }
}

async function setRunInBackground(value: boolean) {
  const response = await runtimeRequest(RUN_IN_BACKGROUND_PATH, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });

  if (!response.ok) {
    throw new Error(`Unable to update ${RUN_IN_BACKGROUND_KEY}`);
  }
}

function stopRuntime() {
  if (runtimeEventsReconnect) {
    clearTimeout(runtimeEventsReconnect);
    runtimeEventsReconnect = null;
  }
  runtimeEventsAbort?.abort();
  runtimeEventsAbort = null;
  runtime?.kill();
  runtime = null;
}

function getTrayIcon() {
  const iconPath = path.join(process.env.VITE_PUBLIC, "electron-vite.svg");
  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty() ? nativeImage.createEmpty() : icon;
}

function restoreWindow(route?: string) {
  if (!win || win.isDestroyed()) {
    createWindow(route);
    return;
  }

  if (win.isMinimized()) {
    win.restore();
  }
  win.show();
  win.focus();

  if (route) {
    navigateWindow(route);
  }
}

function navigateWindow(route: string) {
  if (!win || win.isDestroyed()) return;

  if (win.webContents.isLoading()) {
    win.webContents.once("did-finish-load", () => navigateWindow(route));
    return;
  }

  void win.webContents.executeJavaScript(
    `window.history.pushState(null, "", ${JSON.stringify(route)}); window.dispatchEvent(new PopStateEvent("popstate"));`,
  );
}

async function buildTrayMenu() {
  const runInBackground = await getRunInBackground();
  tray?.setToolTip(
    runInBackground ? "Draftlet - background capture on" : "Draftlet - background capture off",
  );
  tray?.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Open Draftlet",
        click: () => restoreWindow(),
      },
      {
        label: runInBackground ? "Background capture: On" : "Background capture: Off",
        type: "checkbox",
        checked: runInBackground,
        click: async (menuItem) => {
          try {
            await setRunInBackground(menuItem.checked);
          } finally {
            await buildTrayMenu();
          }
        },
      },
      {
        label: "Settings",
        click: () => restoreWindow("/settings"),
      },
      { type: "separator" },
      {
        label: "Quit Draftlet",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
}

function createTray() {
  if (tray) return;

  tray = new Tray(getTrayIcon());
  tray.on("click", () => restoreWindow());
  void buildTrayMenu();
}

ipcMain.handle("runtime:request", async (_event, path: string, init?: RuntimeRequestInit) => {
  const response = await runtimeRequest(path, init);
  if (path.startsWith(RUN_IN_BACKGROUND_PATH)) {
    void buildTrayMenu();
  }
  return response;
});

function createWindow(initialRoute?: string) {
  const { screen } = require("electron");
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  win = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    autoHideMenuBar: true,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  win.on("close", (event) => {
    if (isQuitting) return;

    event.preventDefault();
    void getRunInBackground().then((runInBackground) => {
      if (runInBackground) {
        win?.hide();
        void buildTrayMenu();
        return;
      }

      isQuitting = true;
      app.quit();
    });
  });

  win.on("closed", () => {
    win = null;
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(`${VITE_DEV_SERVER_URL}${initialRoute ?? ""}`);
  } else {
    // win.loadFile('dist/index.html')
    void win.loadFile(path.join(RENDERER_DIST, "index.html")).then(() => {
      if (initialRoute) {
        navigateWindow(initialRoute);
      }
    });
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (isQuitting && process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  restoreWindow();
});

app.on("before-quit", () => {
  isQuitting = true;
  stopRuntime();
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    restoreWindow();
  });

  void app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    startRuntime();
    void connectRuntimeEvents();
    createTray();
    createWindow();
  });
}
