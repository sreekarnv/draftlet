# Setup

Detailed setup and command reference for Draftlet.

## Prerequisites

- Node.js with pnpm
- Python 3.12+
- uv
- Ollama
- An Ollama model, recommended: `gemma3:4b`

## First Run

1. Open the Draftlet desktop app.
2. Install Ollama if it is missing.
3. Start Ollama if it is installed but not running.
4. Pull `gemma3:4b`, or select another installed model.
5. Start the Draftlet server from the desktop app.
6. Build and load the browser extension.
7. Select text on a webpage and open Draftlet.

## Install Dependencies

```bash
pnpm install
cd apps/server
uv sync --group dev
```

## Model Setup

Pull the recommended onboarding model:

```bash
ollama pull gemma3:4b
```

The desktop app can also list installed Ollama models and persist the selected active model. If no model is selected, Draftlet falls back to `gemma3:4b`.

## Database Migrations

Run migrations for the development SQLite database:

```bash
cd apps/server
uv run alembic upgrade head
```

The default development database path is:

```text
apps/server/draftlet.db
```

## Local Development

Run all local development processes:

```bash
pnpm dev
```

Run one app at a time:

```bash
pnpm dev:desktop
pnpm dev:extension
pnpm dev:server
```

Manual server command:

```bash
cd apps/server
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 47632
```

## Extension Loading

Build the Chrome MV3 extension:

```bash
pnpm --dir apps/extension build
```

Load this directory in Chrome with Developer Mode enabled:

```text
apps/extension/.output/chrome-mv3
```

## Build and Package

Run the release-oriented build:

```bash
pnpm build
```

This builds the Python server bundle, packages the Electron desktop app, and builds the browser extension.

Package outputs:

```text
apps/server/dist/draftlet-server/draftlet-server
apps/desktop/out/
apps/extension/.output/chrome-mv3
```

Create desktop installers, including Linux `.deb` and ZIP outputs:

```bash
pnpm make:desktop
```

On Debian/Ubuntu hosts, the Debian maker expects packaging tools such as `fakeroot` and `dpkg`. Installer outputs are written under:

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

Extension:

```bash
pnpm --dir apps/extension exec tsc --noEmit
pnpm --dir apps/extension test
pnpm --dir apps/extension build
```

Desktop:

```bash
pnpm --dir apps/desktop typecheck
pnpm --dir apps/desktop package
```

Server:

```bash
cd apps/server
uv run pytest
uv run alembic upgrade head
```

## Local URLs

- Draftlet server: `http://127.0.0.1:47632`
- Server health: `http://127.0.0.1:47632/health`
- Ollama: `http://127.0.0.1:11434`
- Development SQLite database: `apps/server/draftlet.db`

Useful checks:

```bash
curl http://127.0.0.1:47632/health
curl http://127.0.0.1:47632/domain/history
curl http://127.0.0.1:47632/preferences
curl http://127.0.0.1:11434/api/tags
```

## API

- `GET /health` identifies and checks the Draftlet server
- `POST /replies/{run_id}/start` starts a runtime-owned reply generation run
- `GET /replies/{run_id}/events` streams live/replayed run progress as SSE
- `GET /replies/{run_id}/events?after=N` is intended for active and recent terminal run replay. Runtime keeps active replay rows, caps each run to the latest 100 rows, and prunes terminal run replay rows after 14 days. Older terminal run history remains available through domain snapshots such as `/domain/generation-runs/{run_id}/progress` and `/domain/history`, but the SSE replay feed may no longer have old rows.
- `GET /domain/history` returns recent persisted Draftlet workspace threads
- `GET /diagnostics/generation-runs/maintenance` returns process-local recent startup reconciliation, stale-run reconciliation, and replay-prune outcomes for debugging runtime maintenance behavior
- `GET /preferences` lists saved preferences
- `PUT /preferences` upserts a preference
