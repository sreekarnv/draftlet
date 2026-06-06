# Draftlet

Draftlet is a local-first browser drafting assistant. Select text on a webpage, generate reply drafts with a local Ollama model, then copy or best-effort insert a reply.

## What Draftlet Includes

- **Browser extension:** in-browser selection, Draftlet launcher, reply workspace, history, copy, and insertion.
- **Electron desktop app:** local setup companion for Ollama, model readiness, and Draftlet server controls.
- **Local server:** FastAPI service for prompt building, Ollama streaming, parsing, SSE, SQLite history, and preferences.

Ollama is required separately. Draftlet does not bundle Ollama.

## Demo

### Desktop companion

![Draftlet desktop companion](.github/assets/desktop-companion.png)

Local runtime checklist for Ollama, model readiness, and the Draftlet server.

### Extension workflow

![Draftlet extension workflow](.github/assets/extension-gmail.gif)

Selecting text, opening Draftlet, and generating local reply drafts.

## How It Works

The extension talks to the local server at `http://127.0.0.1:47632`. The server talks to Ollama at `http://127.0.0.1:11434`. The desktop app helps check and manage that local runtime.

Packaged desktop builds can launch a bundled PyInstaller build of the Python server. Development can still run the server with `uv`.

## Main Features

- Detect selected text on webpages
- Open Draftlet from a floating contextual launcher
- Use a Chrome side panel workspace where available
- Keep an in-page Shadow DOM fallback panel
- Generate three draft replies with a selected tone
- Stream replies over SSE from the local server
- Copy replies to clipboard
- Best-effort insert into inputs, textareas, and basic contenteditable editors
- Fall back to copy when insertion is not supported
- Store local history and preferences in SQLite
- Choose an installed Ollama model from the desktop app

## First Run

1. Open the Draftlet desktop app.
2. Install Ollama if it is missing.
3. Start Ollama if it is installed but not running.
4. Pull `gemma3:4b`, or select another installed Ollama model.
5. Start the Draftlet server from the desktop app.
6. Load the browser extension.
7. Select text on a webpage and open Draftlet.
8. Generate, copy, or insert a reply.

For this repo build, load the extension unpacked from:

```text
apps/extension/.output/chrome-mv3
```

## Local Development

Prerequisites:

- Node.js with pnpm
- Python 3.12+
- uv
- Ollama
- An Ollama model, recommended: `gemma3:4b`

Install dependencies:

```bash
pnpm install
cd apps/server
uv sync --group dev
```

Pull the recommended model:

```bash
ollama pull gemma3:4b
```

Run migrations for the development database:

```bash
cd apps/server
uv run alembic upgrade head
```

Run everything locally:

```bash
pnpm dev
```

Run one app at a time:

```bash
pnpm dev:server
pnpm dev:extension
pnpm dev:desktop
```

Manual server command:

```bash
cd apps/server
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 47632
```

## Build

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

Create desktop installers, including Linux `.deb` and ZIP outputs. This also builds the bundled Python server first:

```bash
pnpm make:desktop
```

On Debian/Ubuntu hosts, the Debian maker expects standard packaging tools such as `fakeroot` and `dpkg` to be available.

Installer outputs are written under:

```text
apps/desktop/out/make/
```

The Linux Debian installer is expected under a platform-specific subdirectory such as:

```text
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
curl http://127.0.0.1:47632/history
curl http://127.0.0.1:47632/preferences
curl http://127.0.0.1:11434/api/tags
```

## Extension Output

Build the Chrome MV3 extension:

```bash
pnpm --dir apps/extension build
```

Load this directory in Chrome with Developer Mode enabled:

```text
apps/extension/.output/chrome-mv3
```

## API

- `GET /health` identifies and checks the Draftlet server
- `POST /replies` streams generated replies as SSE
- `GET /history` returns recent generations with replies
- `GET /preferences` lists saved preferences
- `PUT /preferences` upserts a preference


## Troubleshooting

**Ollama is missing:** install it from `https://ollama.com/download`. On Linux, make sure `ollama` is on `PATH`.

**Ollama is installed but not running:** start the Ollama app or run:

```bash
ollama serve
```

**Recommended model is missing:** use the desktop app Pull Model action or run:

```bash
ollama pull gemma3:4b
```

**Draftlet server is not ready:** check health:

```bash
curl http://127.0.0.1:47632/health
```

If another process is using port `47632`, stop that process or adjust local development setup. The desktop app only stops a process when `/health` identifies it as Draftlet.

**Extension cannot connect:** confirm the server is healthy, then reload the extension and webpage.

**Insert does not work on a site:** use Copy. Draftlet insertion is best-effort and varies by editor implementation.

**Electron dev fails on Linux sandbox setup:** this can be a local Electron development environment issue. Check Electron's Linux sandbox guidance for your distro.

## Privacy

Draftlet is local-first:

- Selected text is sent to the local Draftlet server, not a hosted Draftlet service.
- Ollama receives the generation prompt locally.
- Generated replies and selected source text are stored in local SQLite history.
- Packaged desktop builds store runtime data under the app user-data directory.

Delete the local database manually if you want to clear persisted history.

## Current Limitations

- Insertion is not universal across all sites or editors
- Complex rich-text editors may need site-specific support later
- The extension and desktop app assume the server is at `http://127.0.0.1:47632`
- The server and desktop app assume Ollama is at `http://127.0.0.1:11434`
- No extension popup/settings page is included yet
- Preferences are API-backed, but there is no dedicated settings screen yet
- Local model output can still be malformed despite defensive parsing
- The desktop app bundles the Draftlet Python server, but not Ollama
- The extension is currently documented as an unpacked Chrome extension for repo-based testing

## Roadmap

- Package the browser extension for easier installation
- Improve history browsing and filtering
- Add a small settings surface for server URL and model preferences
- Improve insertion support for more editor types
- Tighten CORS origins once extension distribution is finalized
- Improve prompt configuration
