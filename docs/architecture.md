# Architecture

Draftlet has three pieces: the browser extension, the Electron desktop companion, and the local FastAPI server. Ollama remains a separately installed local dependency.

## Browser Extension

The extension is built with WXT and TypeScript. It owns webpage integration: selection detection, floating trigger placement, focus capture, insertion, clipboard fallback, API helpers, SSE reading, and Shadow DOM mounting.

React is used only for the Draftlet panel UI and immediate child components. Low-level browser/page logic stays outside React.

## Desktop Companion

The Electron app helps users prepare the local runtime. It checks whether Ollama is installed/running, lists installed models, persists the selected active model, and starts/stops the Draftlet server.

Electron uses the standard main/preload/renderer split. Privileged checks and process control live in the main process, the preload exposes explicit IPC APIs, and the renderer owns setup/status UI. Raw Node APIs are not exposed to the renderer.

## Local Server

The FastAPI server owns request validation, prompt building, Ollama streaming, delimiter-based parsing, SSE response emission, and persistence. Routes stay thin and orchestration lives in service modules.

The server stores history and preferences in SQLite through SQLAlchemy 2.0, with Alembic migrations for schema changes.

## Ollama

Draftlet calls Ollama at `http://127.0.0.1:11434`. The recommended model is `gemma3:4b`, but the desktop app can select another installed model.

## Packaged Server

The Python server can be built with PyInstaller. Packaged desktop builds can launch that bundled server executable; development still uses the `uv`/Uvicorn command.

## Data Flow

1. User selects text on a webpage.
2. Extension opens Draftlet from the contextual launcher or side panel path.
3. Extension sends selected text, tone, and source context to the local server.
4. Server builds a prompt and streams from Ollama.
5. Server parses replies, persists generation history, and emits SSE events.
6. Extension renders replies and supports copy or best-effort insertion.

## Important Boundaries

- Browser/page integration stays outside React.
- React owns panel rendering and panel-local UI state only.
- The desktop app does not replace the in-browser drafting UX.
- The server owns model orchestration and persistence.
- Ollama is not bundled with Draftlet.
