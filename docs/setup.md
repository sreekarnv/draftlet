# Setup

Detailed setup and command reference for Draftlet.

## Prerequisites

Install these before running Draftlet for the first time.

- **Node.js** with **pnpm** (workspaces enabled)
- **Python 3.12+**
- **[uv](https://docs.astral.sh/uv/)** for Python dependency management
- **[Ollama](https://ollama.com/download)** running on `127.0.0.1:11434`
- An **Ollama model**; `gemma3:4b` is the recommended default
- A **Chromium-based browser** (for example, Chrome) with Developer Mode enabled, for loading the unpacked extension

The desktop companion is an Electron app. On Linux, the packaged installer is produced through Electron Forge's Debian and ZIP makers, which expect packaging tools such as `fakeroot` and `dpkg` to be available.

## Install repo dependencies

From the repo root:

```bash
pnpm install
cd apps/server
uv sync --group dev
cd ../..
```

This installs the Node workspace dependencies (extension, desktop, shared) and the Python server dependencies (including dev tools like PyInstaller and pytest).

## Configure Ollama

Pull the recommended onboarding model:

```bash
ollama pull gemma3:4b
```

Confirm Ollama is reachable and lists your model:

```bash
curl http://127.0.0.1:11434/api/tags
```

The desktop companion can also list installed Ollama models and persist the selected active model. If no model is selected, Draftlet falls back to `gemma3:4b`.

## Apply database migrations

The Draftlet server stores sessions, threads, turns, variants, preferences, and diagnostics in SQLite. Apply the latest schema before first run:

```bash
cd apps/server
uv run alembic upgrade head
```

The default development database path is `apps/server/draftlet.db`. The file is created on first run.

## Run the local stack

Run all three local development processes at once:

```bash
pnpm dev
```

This script starts the FastAPI server, the WXT extension dev process, and the Electron desktop companion, and cleans them up on exit.

Run one app at a time:

```bash
pnpm dev:server
pnpm dev:extension
pnpm dev:desktop
```

The server script runs:

```bash
cd apps/server
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 47632
```

## Load the browser extension

Build the Chrome MV3 extension:

```bash
pnpm --dir apps/extension build
```

The unpacked build is written to:

```text
apps/extension/.output/chrome-mv3
```

Open your browser's extensions page, enable Developer Mode, and choose **Load unpacked**. Point it at the `chrome-mv3` directory above. After you change extension code, rebuild and reload the unpacked extension from the extensions page.

## Run the desktop app

The desktop companion starts through:

```bash
pnpm dev:desktop
```

It exposes setup, runtime start/stop, model selection, diagnostics, and tray behavior. Use it as the primary way to check Ollama, model, and server readiness.

### Linux (chrome-sandbox)

On Linux, `pnpm dev:desktop` requires the Electron SUID helper at `apps/desktop/node_modules/electron/dist/chrome-sandbox` to be **root-owned** and mode `4755`. If those permissions are missing, the helper aborts on startup and the desktop companion never opens a window.

Apply the fix from the repo root:

```bash
sudo chown root:root apps/desktop/node_modules/electron/dist/chrome-sandbox
sudo chmod 4755    apps/desktop/node_modules/electron/dist/chrome-sandbox
```

If you cannot elevate, the desktop companion has a **dev-only** escape hatch that disables the sandbox:

```bash
ELECTRON_DISABLE_SANDBOX=1 pnpm dev:desktop
```

This is for local development only. Do not ship it and do not use it for workflows that handle untrusted content. The full recipe and trade-offs are in [troubleshooting.md](troubleshooting.md#electron-dev-fails-on-linux-sandbox-setup). The packaged build path (`pnpm make:desktop`) ships a correctly-permissioned helper and is unaffected.

## Verify the server is healthy

After starting the server, confirm it responds:

```bash
curl http://127.0.0.1:47632/health
```

Useful sanity checks:

```bash
curl http://127.0.0.1:47632/health
curl http://127.0.0.1:47632/domain/history
curl http://127.0.0.1:47632/preferences
curl http://127.0.0.1:11434/api/tags
```

If the server fails to start because port `47632` is in use, stop the conflicting process. The desktop companion only stops a process holding the port if `/health` identifies it as a Draftlet server.

## CORS and local origins

The Draftlet server only allows requests from a configured local origin allowlist. By default that allowlist is:

- `http://127.0.0.1:47632`
- `http://localhost:47632`
- `http://127.0.0.1:5173` and `http://localhost:5173` (the Vite dev server, if you use it)

The server also accepts a default `chrome-extension://<id>` regex so unpacked extension builds work without you having to look up the extension ID first. The server is bound to `127.0.0.1` only, so the loopback-only exposure is the trade-off for the chrome-extension default.

Tighten the allowlist with environment variables when needed:

- `DRAFTLET_CORS_ALLOW_ORIGINS` — comma-separated list of allowed origins. Replaces the default loopback list.
- `DRAFTLET_CORS_ALLOW_ORIGIN_REGEX` — Python regex matched against the request `Origin` header. Set to `disabled` to drop the default `chrome-extension://<id>` pattern entirely.

## Local URLs and ports

- **Draftlet server:** `http://127.0.0.1:47632`
- **Server health:** `http://127.0.0.1:47632/health`
- **Ollama:** `http://127.0.0.1:11434`
- **Development SQLite database:** `apps/server/draftlet.db`
- **Extension build:** `apps/extension/.output/chrome-mv3`

The extension currently expects the server at `http://127.0.0.1:47632`. There is no remote server option.

## Common first-run expectations

- The first `pnpm install` can take a few minutes because the workspace pulls the extension, desktop, and shared packages.
- The first server start creates `apps/server/draftlet.db` if it does not exist. Delete that file to reset local history and preferences.
- The first extension build can take a minute or two; subsequent builds are faster.
- The first draft generation is slow because Ollama loads the model into memory. Later generations on the same model are much faster.
- If you change Python dependencies, rerun `uv sync --group dev` inside `apps/server`.
- If you change Node dependencies, rerun `pnpm install` from the repo root.
- Packaged desktop builds store runtime data under the Electron user-data directory, not inside the repo. The development server and database always live under `apps/server/`.

## Build and package

Release-oriented build (Python server bundle, packaged desktop app, browser extension):

```bash
pnpm build
```

This runs the shared package build, builds a PyInstaller onedir server bundle, packages the Electron desktop app with that bundle copied in, and builds the browser extension.

Package outputs:

```text
apps/server/dist/draftlet-server/draftlet-server
apps/desktop/out/
apps/extension/.output/chrome-mv3
```

Create desktop installers (Linux `.deb` and ZIP):

```bash
pnpm make:desktop
```

On Debian/Ubuntu hosts, this expects packaging tools such as `fakeroot` and `dpkg` to be installed. Installer outputs are written under:

```text
apps/desktop/out/make/
apps/desktop/out/make/deb/x64/*.deb
```

Component-level builds:

```bash
pnpm --dir apps/extension build
pnpm --dir apps/desktop package
pnpm --dir apps/desktop make
cd apps/server && uv run pyinstaller --clean --noconfirm draftlet-server.spec
```

## Tests

Run tests for each app from the repo root.

Extension:

```bash
pnpm --dir apps/extension exec tsc --noEmit
pnpm --dir apps/extension test
pnpm --dir apps/extension build
```

Desktop:

```bash
pnpm --dir apps/desktop typecheck
pnpm --dir apps/desktop test
pnpm --dir apps/desktop package
```

Server:

```bash
cd apps/server
uv run pytest
uv run alembic upgrade head
```

The GitHub Actions workflow at `.github/workflows/ci.yml` runs the extension, desktop, and server checks on push and pull request.

## API surface

The runtime exposes a small HTTP and SSE API for the extension and desktop surfaces.

- `GET /health` — identifies and checks the Draftlet server
- `POST /replies/{run_id}/start` — starts a runtime-owned reply generation run
- `POST /replies/{run_id}/cancel` — cancels a claimed run; the active stream stops at the next bounded check
- `GET /replies/{run_id}/events` — streams live and replayed run progress as SSE
- `GET /replies/{run_id}/events?after=N` — replay feed for active and recent terminal runs; older terminal run history remains available through `/domain/generation-runs/{run_id}/progress` and `/domain/history`, but the SSE replay feed may no longer have old rows
- `GET /domain/history` — recent persisted Draftlet workspace threads
- `GET /domain/generation-runs/{run_id}/progress` — bounded durable progress snapshot for a run
- `GET /domain/generation-runs/execution-state` — bounded restore candidates for browser restore
- `GET /diagnostics/generation-runs/maintenance` — process-local recent startup reconciliation, stale-run reconciliation, and replay-prune outcomes
- `GET /diagnostics/browser-recapture` — latest privacy-bounded browser recapture diagnostics report published by the extension
- `GET /preferences` — list saved preferences
- `PUT /preferences` — upsert a preference
