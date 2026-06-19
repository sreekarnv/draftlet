# Draftlet

Draftlet is a local-first browser drafting assistant. It helps you capture context from a webpage, generate reply drafts through a local Ollama model, refine those drafts over multiple turns in a thread, and insert only the text you approve back into the page.

The webpage never owns the Draftlet workflow. Draftlet-owned surfaces (the browser extension's side panel, the desktop companion, and the local server) own the assistant experience. The page is only an integration point for context capture, editable target detection, and best-effort insertion.

![Draftlet side panel generating a draft from selected text in Gmail](.github/assets/extension-gmail.gif)

## What's included

- **Browser extension** — Chrome MV3 extension with a content script for page integration, a background coordinator for browser-level routing, a side panel as the primary drafting workspace, and a popup for quick actions and runtime status.
- **Local FastAPI server** — Ollama streaming, prompt building, response parsing, SQLite persistence for sessions, threads, turns, draft variants, preferences, and diagnostics.
- **Electron desktop companion** — first-run setup, runtime start/stop controls, model selection, tray behavior, and diagnostics.
- **Shared contracts** — typed messages and schemas used across the extension, desktop, and runtime boundaries.

## What's not included

- **Ollama is not bundled.** Install it separately from [ollama.com/download](https://ollama.com/download) and pull a model. `gemma3:4b` is the recommended default; the desktop companion can switch to any installed model.
- **No remote server.** The Draftlet server runs on `http://127.0.0.1:47632` and is reachable from the extension and the desktop companion over loopback. There is no hosted Draftlet service.
- **No signed store build.** The extension is loaded as an unpacked build from this repository. There is no Chrome Web Store build yet.
- **No favorites, no in-page overlay, no legacy history.** Draftlet only drafts into the side panel, persists workspace sessions and threads locally, and inserts into the page through best-effort page integration. Nothing else.

## Requirements

- Node.js with pnpm (workspaces enabled)
- Python 3.12+
- [uv](https://docs.astral.sh/uv/) for Python dependency management
- [Ollama](https://ollama.com/download) running on `127.0.0.1:11434`
- An Ollama model; `gemma3:4b` is the recommended default
- A Chromium-based browser (for example, Chrome) with Developer Mode enabled, for loading the unpacked extension

The desktop companion runs on the platforms Electron supports. The Linux desktop build uses Electron Forge Debian and ZIP makers.

## Quick start

The shortest first-run walkthrough lives in [docs/getting-started.md](docs/getting-started.md). Use [docs/setup.md](docs/setup.md) when you need the full command reference.

1. Install Ollama and pull a model:

   ```bash
   ollama pull gemma3:4b
   ```

2. Install repo dependencies:

   ```bash
   pnpm install
   cd apps/server && uv sync --group dev && cd ../..
   ```

3. Apply server database migrations:

   ```bash
   cd apps/server && uv run alembic upgrade head && cd ../..
   ```

4. Start the local stack (server, extension dev, desktop):

   ```bash
   pnpm dev
   ```

   Or start one app at a time:

   ```bash
   pnpm dev:server
   pnpm dev:extension
   pnpm dev:desktop
   ```

5. Build the extension and load it as an unpacked extension:

   ```bash
   pnpm --dir apps/extension build
   ```

   Load the directory `apps/extension/.output/chrome-mv3` in your browser's extensions page with Developer Mode enabled.

6. Select text on a page, open the Draftlet side panel, and generate a reply.

## Extension loading

The extension is a WXT-built Chrome MV3 unpacked build:

1. Run `pnpm --dir apps/extension build` to produce `apps/extension/.output/chrome-mv3`.
2. Open your browser's extensions page.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and point it at the directory above.
5. After code changes, rebuild and click **Reload** on the Draftlet extension card.

The extension expects the Draftlet server at `http://127.0.0.1:47632`. If the server stops, the side panel and popup surface a connection error with a retry control.

## Desktop companion

![Draftlet desktop companion showing runtime and model controls](.github/assets/desktop-companion.png)

The desktop companion is an Electron app for first-run setup and runtime operations:

- Checks whether Ollama is installed and running.
- Lists installed Ollama models and lets you select the active model.
- Starts, stops, and restarts the local Draftlet server.
- Exposes a system tray icon for quick access.
- Shows a diagnostics page that reads the latest browser recapture diagnostics report from the runtime relay and the runtime's generation-run maintenance endpoint.

The desktop companion does not replace the side panel. It is the operator-facing shell for setup, runtime lifecycle, and operational diagnostics. The primary drafting workflow lives in the extension's side panel.

For the Linux Electron `chrome-sandbox` SUID helper issue, see [docs/troubleshooting.md](docs/troubleshooting.md#electron-dev-fails-on-linux-sandbox-setup).

## Local data

Draftlet stores data in two places:

- **SQLite database** at `apps/server/draftlet.db` during development, and under the Electron user-data directory in packaged desktop builds. The schema holds `WorkspaceSession`, `ConversationThread`, `Turn`, `DraftVariant`, `GenerationRun`, `GenerationRunEvent`, preferences, and bounded browser recapture diagnostics reports.
- **Browser extension storage** holds only lightweight coordination state (for example, the last selected tone).

To reset development state, stop the server and delete the database file:

```bash
rm apps/server/draftlet.db
```

The next server start recreates the database after `uv run alembic upgrade head`. Migration history is preserved across resets; only the data is removed.

Draftlet only controls its own processes. It cannot prevent the browser, the page, or the operating system from capturing content elsewhere.

## Architecture summary

Draftlet is composed of six surfaces, each with a narrow responsibility:

- **Content script** — page integration. Detects editable surfaces, captures selection, performs best-effort insertion. Does not own business logic, persistence, or runtime connection.
- **Extension service worker (background)** — command routing, tab/session coordination, capability checks, and bridge orchestration to the runtime. Holds lightweight browser-level state only.
- **Side panel** — the primary Draftlet workspace. Thread view, streaming drafts, follow-up instructions, draft variants, review, and insertion controls.
- **Popup** — runtime status, quick actions, refresh, and entry into the side panel. Compact. Recapture diagnostics, when shown, are dev-only and gated behind `DRAFTLET_DEBUG_INSERTION=1`.
- **Desktop app** — first-run setup, runtime lifecycle, tray behavior, settings, and diagnostics.
- **Local runtime** — Ollama streaming, prompt building, response parsing, SQLite persistence, and the bounded durable diagnostics relay.

The full architecture, setup, troubleshooting, boundaries, and contracts are documented under [docs/](docs/):

- [Architecture](docs/architecture/architecture.md)
- [Boundaries](docs/architecture/boundaries.md)
- [Events and contracts](docs/architecture/events-and-contracts.md)
- [Current state and open cleanup notes](docs/architecture/phase-plan.md)
- [UI principles](docs/ui/ui-principles.md)
- [Getting started](docs/getting-started.md)
- [Setup](docs/setup.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Public release checklist](docs/release-checklist.md)
- [Developer docs](docs/dev/) (recapture target recovery background contract, dev-only manual QA)

## Development commands

Run from the repo root unless noted.

```bash
pnpm typecheck
pnpm build
pnpm make:desktop
```

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
pnpm --dir apps/desktop make
```

Server:

```bash
cd apps/server
uv run pytest
uv run alembic upgrade head
```

## Troubleshooting

- [Getting started](docs/getting-started.md)
- [Setup walkthrough](docs/setup.md)
- [Common failures and recipes](docs/troubleshooting.md) — Ollama, server health, port conflicts, extension loading, Linux Electron `chrome-sandbox`, stale or interrupted generation recovery
- [Release checklist](docs/release-checklist.md) — the public-readiness pass we run before tagging a release

## License

[MIT](LICENSE)
