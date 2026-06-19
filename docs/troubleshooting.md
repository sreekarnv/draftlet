# Troubleshooting

This guide covers the most common first-run and recurring issues. If something is missing here, use the desktop companion diagnostics and the runtime maintenance endpoint to gather more information.

For the shortest install-to-first-draft walkthrough, start with [getting-started.md](getting-started.md).

## First checks

Before going deep, confirm the two local services in order:

```bash
curl http://127.0.0.1:11434/api/tags
curl http://127.0.0.1:47632/health
```

If the first command fails, Ollama is the problem. If the second fails, the Draftlet server is the problem. The extension can only work when both are reachable.

Also confirm the model is installed:

```bash
ollama list
```

What happened: Draftlet depends on a local Ollama service, a local Draftlet server, and an unpacked browser extension. If any one piece is missing or stale, drafting may stop before generation starts.

What to do next: start with Ollama, then the Draftlet server, then reload the extension and the page you are drafting on.

## Ollama is missing

What happened: the desktop companion could not find the `ollama` command on this machine.

What to do next: install Ollama, then recheck from the desktop companion or terminal.

Install Ollama from [ollama.com/download](https://ollama.com/download). On Linux, make sure the `ollama` binary is on your `PATH` (the installer usually puts it under `~/.local/bin` or `/usr/local/bin`).

Verify the install:

```bash
ollama --version
```

## Ollama is installed but not running

What happened: the `ollama` command exists, but the local service is not responding on `127.0.0.1:11434`.

What to do next: start Ollama, then recheck.

Start the Ollama app, or run:

```bash
ollama serve
```

Then recheck status in the desktop companion or with:

```bash
curl http://127.0.0.1:11434/api/tags
```

## Recommended model is missing

What happened: Ollama is reachable, but the recommended onboarding model is not installed.

What to do next: pull `gemma3:4b`, or select another installed model in the desktop companion.

`gemma3:4b` is the recommended default. Pull it manually:

```bash
ollama pull gemma3:4b
```

Or use the desktop companion's **Pull Model** action. If a different model is already selected in the desktop companion, Draftlet will use that model instead.

## Draftlet server is not reachable

What happened: the extension or desktop companion could not reach the local Draftlet server at `http://127.0.0.1:47632`.

What to do next: start the server from the desktop companion or with `pnpm dev:server`, then check `/health`.

Check the server health endpoint:

```bash
curl http://127.0.0.1:47632/health
```

If the request fails:

- The server is not running. Start it with `pnpm dev:server` or from the desktop companion.
- The server crashed during startup. Run it in a terminal to see the error: `cd apps/server && uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 47632`.
- Migrations are out of date. Run `cd apps/server && uv run alembic upgrade head`.

## Port 47632 is already in use

Another process is bound to the Draftlet server port. Stop that process, or change the port in your local dev command and update any client that points at it. The desktop companion only stops a process holding the port if `/health` identifies it as a Draftlet server, so it will not kill unrelated processes.

## Extension cannot connect to the runtime

What happened: the browser extension cannot reach the local Draftlet server.

What to do next: confirm the server is healthy, reload the unpacked extension, and reload the page you are drafting on.

- Confirm the server is healthy with `curl http://127.0.0.1:47632/health`.
- Confirm the extension is loaded. Open the browser's extensions page and check that Draftlet is enabled.
- Reload the extension from the extensions page, then reload the page you are drafting on.
- The extension currently expects the server at `http://127.0.0.1:47632`. There is no remote option yet.
- If the extension was loaded from a stale build, rebuild it with `pnpm --dir apps/extension build` and reload the unpacked extension.

## Reload the extension

After changing extension source, you must rebuild and reload the unpacked extension. The browser does not pick up code changes from disk on its own.

1. From the repo root, rebuild:

   ```bash
   pnpm --dir apps/extension build
   ```

2. Open your browser's extensions page.
3. Find the Draftlet card and click **Reload**.
4. Reload the page you are drafting on so the content script reattaches.

If the extension still behaves like the old build, remove the unpacked extension and re-load it from `apps/extension/.output/chrome-mv3`. A stale manifest, a partial WXT dev cache, or a browser update can leave the loaded extension out of sync with the source. Clear `apps/extension/.wxt/` and `apps/extension/.output/` (both are gitignored) before rebuilding if the reload does not take.

## Side panel does not open

- Make sure the extension is loaded and enabled. Chrome's side panel needs a recent Chromium build; very old browsers do not expose a side panel entry.
- Pin the Draftlet side panel from the browser's side panel menu, or use the Draftlet toolbar icon to open it.
- If the side panel is open but empty, the extension may not have a current tab session. Click into the page once to refresh tab identity, then reopen the side panel.
- Check the browser's extensions page for extension errors and reload the extension if needed.

## Selected text is not captured

- Draftlet captures selection on a focused normal text selection. Selections inside form fields, cross-origin iframes, and shadow roots that the page isolates from the top-level document can be harder to capture.
- If selection is lost when you click the Draftlet trigger, try reselecting and opening the side panel without clicking outside the selection first.
- Some sites override selection events. On those pages, Draftlet can fall back to copy. Use **Copy** and paste manually when capture is blocked.
- If the page has re-rendered since you last selected, the previous target may be stale. Re-select the text and reopen the side panel.

## Insert fails or the compose field is unavailable

What happened: Draftlet generated a draft, but the original compose field could not be reached safely. The page may have re-rendered, navigated, moved focus, or used a rich editor Draftlet cannot insert into.

What to do next: use **Copy** and paste manually, or focus the compose field on the original page and try insertion again when Draftlet asks for focus.

Insertion is best-effort. Draftlet targets native inputs, textareas, and basic `contenteditable` editors first. Rich text editors, canvas surfaces, cross-origin iframes, and editors that listen to a custom input pipeline are likely to need manual paste.

When insertion fails:

- Use **Copy** and paste manually into the target editor.
- If Draftlet shows a recapture option, retry recapture so the extension rebinds to the current focused compose field. The recapture path is covered in [recapture-validation.md](recapture-validation.md).
- Make sure the target field is focused before retry. The side panel will tell you when a focus-required recapture is the next step.

## Stale or interrupted generation recovery

If the server restarts, the browser disconnects, or you close the page during a generation:

- The runtime marks the in-flight run as interrupted. The side panel shows the affected turn as a recoverable failed turn.
- Recovery does not resume a model stream mid-token. Retry starts a fresh `Turn` and `GenerationRun` from the existing thread context.
- The recapture diagnostics report and the runtime maintenance endpoint can help confirm whether the run was interrupted, cancelled, or completed before the disconnect.
- Restored sessions whose original tab is still around show a recapture prompt instead of an auto-resume. Follow the focus-required flow and retry insertion.

## Desktop tray behavior

The desktop companion registers a tray icon when it starts.

- **Left-click** the tray icon to open the desktop window.
- **Right-click** for a small menu with options like opening the window, showing runtime status, and quitting.
- The tray icon is part of the desktop companion, not the server. Quitting the desktop window keeps the Draftlet server running if you started it separately, and vice versa.
- If the tray icon does not appear, your desktop environment may not support it. Run the desktop companion in the foreground and use the window for setup, status, and diagnostics.

## Where diagnostics live

- The desktop companion has a **Diagnostics** page that shows runtime status, recent recapture diagnostics, and server health.
- The runtime exposes a maintenance endpoint:

  ```bash
  curl http://127.0.0.1:47632/diagnostics/generation-runs/maintenance
  ```

  This returns the latest startup reconciliation, stale-run reconciliation, replay-prune outcomes, and the most recent 20 retained outcomes. Diagnostics are kept for up to 30 days or 100 maintenance outcomes, whichever bound is reached first.
- The extension publishes a privacy-bounded browser recapture report to the runtime, and the desktop companion reads the latest report through:

  ```bash
  curl http://127.0.0.1:47632/diagnostics/browser-recapture
  ```

  The report is intentionally narrow: it includes metadata, status, and outcome fields, but never selected text, generated draft text, full page content, DOM selectors, cookies, tokens, or local runtime secrets.
- Extension logs and popup diagnostics are also available directly in the browser's extensions page when you need to inspect a specific page interaction.

## Desktop companion fails to launch

`pnpm dev:desktop` starts the Electron desktop companion through `scripts/dev-desktop.sh`. The most common launch failure on Linux is the `chrome-sandbox` SUID helper, which is documented separately in the next section. Other common launch failures:

- **Stale build cache.** If the Electron Forge Vite cache is out of sync, remove it and retry:

  ```bash
  rm -rf apps/desktop/.vite apps/desktop/out
  pnpm --dir apps/desktop start
  ```

- **Port 47632 already in use by something other than Draftlet.** Stop the conflicting process or change the port in the desktop settings.
- **Ollama is unreachable on startup.** The desktop companion will still launch, but the runtime status card will show a connection error. Start Ollama and refresh the status card.
- **macOS or Windows fails to open a window.** The Electron dev process should still print logs to the terminal that launched it. Read the first error line; it usually names a missing native module (rerun `pnpm install`) or a Gatekeeper / SmartScreen prompt (allow the app to open and retry).
- **Dev-only sandbox flag.** If you cannot apply the `chmod 4755` fix on Linux, see the next section for the dev-only `ELECTRON_DISABLE_SANDBOX=1` escape hatch. Never ship a packaged build with that flag.

If the desktop window never appears and no error is printed, run `pnpm --dir apps/desktop start` directly in a terminal so the Electron main-process output is visible.

## Electron dev fails on Linux sandbox setup

What happened: Electron could not start its Chromium sandbox helper in local development.

What to do next: set the helper ownership/mode with the recommended `sudo` commands below, or use the dev-only sandbox escape hatch when you cannot elevate.

On Linux, `pnpm dev:desktop` launches the desktop companion through `electron-forge start`, which uses the Chromium SUID helper at:

```text
apps/desktop/node_modules/electron/dist/chrome-sandbox
```

For Electron's multi-process architecture to start, that helper must be **root-owned** and have the **setuid bit set** (mode `4755`). When it is not, the Electron main process aborts on startup with errors like `The SUID sandbox helper binary was found, but is not configured correctly` or `chrome-sandbox must be owned by root`.

### Recommended fix (setuid the helper)

Run from the repo root, adjusting the path if your `node_modules` lives elsewhere (use `find apps/desktop/node_modules/electron -name chrome-sandbox` to locate it):

```bash
sudo chown root:root apps/desktop/node_modules/electron/dist/chrome-sandbox
sudo chmod 4755    apps/desktop/node_modules/electron/dist/chrome-sandbox
```

Verify the helper now has the right permissions:

```bash
stat -c '%a %U:%G' apps/desktop/node_modules/electron/dist/chrome-sandbox
# expected: 4755 root:root
```

`pnpm install` re-extracts Electron on the next install, which resets the helper's ownership and mode. Re-apply the two `sudo` commands after every `pnpm install` on Linux until you switch to a permanent packaging path.

### Dev-only fallback (no `sudo`, weaker security)

If you cannot elevate (no `sudo`, locked-down distro, or you do not want to SUID a local file), the desktop companion can start with the renderer sandbox disabled. This is **dev-only**. Do **not** use it in production, do not ship it, and do not run the desktop companion with this flag for any workflow that handles untrusted content:

```bash
ELECTRON_DISABLE_SANDBOX=1 pnpm dev:desktop
```

`scripts/dev-desktop.sh` prints a one-line stderr notice on Linux when the helper is not mode `4755`. It does **not** auto-disable the sandbox and does **not** auto-chmod; both decisions stay with you.

### Packaged build is unaffected

`pnpm make:desktop` produces an installer that ships the helper with the correct ownership and mode. The Linux `.deb` and ZIP outputs under `apps/desktop/out/make/` are the supported way to run the desktop companion in a normal user environment without touching `sudo` or the sandbox flag.

## Clearing local history

Development history and preferences are stored in SQLite at `apps/server/draftlet.db`. Packaged desktop builds store runtime data under the Electron user-data directory, not inside the repo.

To reset local development state, stop the server and delete the database file:

```bash
rm apps/server/draftlet.db
```

The next server start will recreate the database after `uv run alembic upgrade head`.
