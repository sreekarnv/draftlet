# Draftlet

Draftlet is a local-first browser drafting assistant that uses a local Ollama model to help draft replies from selected webpage text.

## What it does

- Select text on a webpage.
- Open the Draftlet side panel.
- Generate reply drafts from your local Ollama model.
- Refine drafts in a thread with follow-up instructions.
- Copy a reply, or let Draftlet try to insert it into the page for you.
- Use the desktop companion to set up Ollama, the model, and the local Draftlet server.

## Why local-first

- Drafts are generated through a local runtime, not a hosted Draftlet service.
- Ollama runs on your machine, so prompts and generated text stay between your browser, the Draftlet server, and Ollama.
- The Draftlet server stores sessions, threads, and preferences in a local SQLite database.

Draftlet can only control what runs in its own processes. Your browser, the page you are on, and your operating system can still capture, log, or sync content outside of Draftlet.

## Current status

Draftlet is an early local-first project under active development. The repository supports local development and manual extension loading.

- The browser extension builds as an unpacked Chrome MV3 extension for development. It is not currently distributed through the Chrome Web Store.
- The desktop companion is an Electron app for setup, runtime controls, diagnostics, and tray behavior.
- Generation quality depends on the local Ollama model you install and the model Draftlet selects.

## Requirements

- Node.js with pnpm (workspaces enabled)
- Python 3.12+
- [uv](https://docs.astral.sh/uv/) for Python dependency management
- [Ollama](https://ollama.com/download), running on `127.0.0.1:11434`
- An Ollama model; `gemma3:4b` is the recommended default
- A Chromium-based browser (for example, Chrome) with Developer Mode enabled to load the unpacked extension

The desktop companion runs on the platforms Electron supports. The Linux desktop build uses Electron Forge Debian and ZIP makers.

## Quick start

The full setup walkthrough lives in [docs/setup.md](docs/setup.md).

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

## Documentation

- [Setup and commands](docs/setup.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Recapture validation checklist](docs/recapture-validation.md)
- [Architecture](docs/architecture/architecture.md)
- [Boundaries](docs/architecture/boundaries.md)
- [Events and contracts](docs/architecture/events-and-contracts.md)
- [Phase plan](docs/architecture/phase-plan.md)
- [UI principles](docs/ui/ui-principles.md)
- [Legacy docs (v1 / POC)](docs/v1/README.md)

## Current limitations

- Ollama must be installed and running separately. Draftlet does not bundle it.
- Generation quality depends on the local model. Smaller models can produce shallow or malformed replies.
- Insertion back into a webpage is best-effort. Pages that use complex editors (for example, rich text or canvas) may fall back to copy.
- The extension must be loaded as an unpacked build from this repository. There is no signed store build yet.
- The Draftlet server must be running for the extension to generate replies. If the server stops, the extension surfaces a connection error and offers a retry.
- The extension currently expects the local server at `http://127.0.0.1:47632`.
- Draftlet only controls its own processes. It cannot prevent the browser, the page, or the operating system from capturing content elsewhere.

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

## License

[MIT](LICENSE)
