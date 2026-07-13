# Draftlet

Local-first writing assistant for Linux desktop. Capture conversations, generate
drafts through local LLM providers (Ollama first), keep durable local memory,
and review in a serious writing surface — without sending your data anywhere.

## Status

Pre-alpha. The current code base is the desktop POC (see [`desktop/`](./desktop)).
A larger rewrite is in planning: shared contracts, a local FastAPI runtime, and
a Gmail browser extension. See the in-repo planning notes and
[`desktop/AGENTS.md`](./desktop/AGENTS.md) for the active work.

## Surfaces (planned)

- **Desktop** (Electron) — main product shell. Library, Drafts, Bookmarks,
  Connectors, Search, Settings, Diagnostics.
- **Browser extension** (Chrome / Firefox) — Gmail connector, side panel
  drafting, popup status.
- **Runtime** (local FastAPI daemon) — owns persistence, prompt building, and
  generation. Exposes typed APIs to desktop and extension.
- **Telegram connector** — MTProto user-client integration. This uses
  `api_id` / `api_hash` from `my.telegram.org`, not a `@BotFather` bot token.

## Layout

```text
draftlet/
  desktop/         Electron + React 19 + Vite+ (current POC, v1.0.0-alpha1)
  packages/        shared contracts (planned)
  apps/            runtime + extension (planned)
  docs/            architecture, UI principles, phase plan (planned)
```

## Supported scope (target)

- Linux desktop (AppImage first).
- Source connectors: Gmail (via extension), Telegram through MTProto user-client
  auth.
- Provider connector: Ollama (local).
- Local persistence in SQLite.

## Out of scope (for now)

- Auto-capture across arbitrary apps.
- macOS / Windows desktop builds.
- WhatsApp native desktop capture.
- Cloud sync, accounts, billing, team features.

## License

AGPLv3. See [`LICENSE`](./LICENSE).

## Development

The active work happens in [`desktop/`](./desktop). From there:

```bash
vp install
vp check
vp dev
```

`vp` is the Vite+ unified CLI. See `desktop/AGENTS.md` for the full workflow.
