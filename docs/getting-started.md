# Getting Started

This is the shortest path from a fresh checkout to a first Draftlet draft.

Draftlet is a local-first browser drafting assistant. You select or capture context from a webpage, Draftlet generates a reply with a local Ollama model, you refine the draft in the extension side panel, and only the text you approve is inserted back into the page.

Draftlet does not include Ollama and does not use a hosted Draftlet service. Ollama runs separately on your machine, and the Draftlet server listens on `http://127.0.0.1:47632`.

For the full command reference, see [setup.md](setup.md). For failures and recovery steps, see [troubleshooting.md](troubleshooting.md).

## Prerequisites

Install these before the first run:

- Node.js 20+ with pnpm
- Python 3.12+
- [uv](https://docs.astral.sh/uv/) for Python dependencies
- [Ollama](https://ollama.com/download), installed separately
- An Ollama model; `gemma3:4b` is the recommended onboarding model
- Chrome or another Chromium-based browser with Developer Mode enabled

## 1. Install dependencies

From the repo root:

```bash
pnpm install
cd apps/server
uv sync --group dev
cd ../..
```

## 2. Install and start Ollama

Install Ollama from [ollama.com/download](https://ollama.com/download), then make sure it is running. On Linux, you can start it in a terminal:

```bash
ollama serve
```

In another terminal, confirm Ollama responds:

```bash
curl http://127.0.0.1:11434/api/tags
```

## 3. Pull the recommended model

Pull the recommended onboarding model:

```bash
ollama pull gemma3:4b
```

Confirm it is available:

```bash
ollama list
```

The desktop companion can use another installed Ollama model if you select it there.

## 4. Prepare the Draftlet database

Apply the current server migrations:

```bash
cd apps/server
uv run alembic upgrade head
cd ../..
```

## 5. Start Draftlet

Start the local development stack:

```bash
pnpm dev
```

This starts the FastAPI server, extension dev process, and Electron desktop companion.

You can also start each piece separately:

```bash
pnpm dev:server
pnpm dev:extension
pnpm dev:desktop
```

Confirm the Draftlet server responds:

```bash
curl http://127.0.0.1:47632/health
```

Use the desktop companion to check Ollama, model, and server readiness. If the desktop app does not open on Linux, see the [Electron sandbox troubleshooting recipe](troubleshooting.md#electron-dev-fails-on-linux-sandbox-setup).

## 6. Build and load the browser extension

Build the unpacked Chrome MV3 extension:

```bash
pnpm --dir apps/extension build
```

Then load it in Chrome or Chromium:

1. Open the browser extensions page.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select `apps/extension/.output/chrome-mv3`.
5. After rebuilding extension code, click **Reload** on the Draftlet extension card and reload the page you are drafting on.

## 7. Generate a draft

1. Open a page with text you want to reply to.
2. Select the relevant text.
3. Open the Draftlet side panel from the extension.
4. Choose a tone and generate a draft.
5. Review or refine the draft.
6. Use **Insert** to place it into the page, or **Copy** and paste manually if the compose field cannot be reached.

The first generation can be slow while Ollama loads the model into memory. Later generations with the same model are usually faster.

## Quick Checks

Use these checks when something does not work:

```bash
curl http://127.0.0.1:11434/api/tags
curl http://127.0.0.1:47632/health
ollama list
```

If Ollama is not reachable, start Ollama. If the Draftlet server is not reachable, start it from the desktop companion or with `pnpm dev:server`. If the extension still shows the server as offline, reload the unpacked extension and reload the page.
