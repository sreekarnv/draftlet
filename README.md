<p align="center">
  <img src=".github/assets/logo.webp" alt="Draftlet" width="128" />
</p>

<h1 align="center">Draftlet</h1>

<p align="center">
  Local-first writing assistant.
</p>

Draftlet captures conversations, generates drafts through local LLM providers
(Ollama first), keeps durable local memory, and lets you review everything in a
focused desktop writing surface without sending your data to a cloud service.

## Status

Draftlet is in active alpha development as `v1.0.0-alpha1`. It is not published
as a release yet.

Current working scope:

- **Telegram** - local MTProto user-client auth, incoming capture, draft
  generation, and explicit send.
- **Gmail** - Chrome extension selection capture into the local runtime, rendered
  in the Email workspace for drafting.
- **Desktop** - Electron app with Messages, Email, Connectors, Settings, Search,
  and local runtime status surfaces.
- **Runtime** - local FastAPI service with SQLite persistence, capture ingest,
  connector management, search, and local generation through Ollama.

Still in progress:

- Gmail OAuth/API sync.
- Gmail send and compose insertion.
- Packaged runtime installation.
- Production hardening and installer polish.
- Windows/macOS support.

## Repository Layout

```text
draftlet/
  api/        local FastAPI runtime and connector services
  desktop/    Electron + React 19 + Vite+ desktop app
  extension/  WXT + React Chrome extension for Gmail capture
```

## Development

Folder READMEs contain build and run instructions for each surface:

- [`api/`](./api) - local runtime.
- [`desktop/`](./desktop) - desktop app. Desktop development requires the API
  runtime to be running separately.
- [`extension/`](./extension) - Gmail Chrome extension.

## Scope

- Linux desktop first.
- Local runtime at `127.0.0.1:8000` during development.
- Source connectors: Telegram and Gmail.
- Provider connector: Ollama.
- Local persistence in SQLite.

## Out Of Scope For Now

- Cloud sync, accounts, billing, or team features.
- Auto-capture across arbitrary apps.
- WhatsApp native desktop capture.
- Gmail OAuth/API sync or external email sending.

## License

AGPLv3. See [`LICENSE`](./LICENSE).
