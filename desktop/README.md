# Draftlet Desktop

Electron + React 19 + Vite+ shell for Draftlet. This is the main product
surface. See [`/README.md`](../README.md) for the project overview.

## Status

Pre-alpha. The current code base is the POC for the desktop shell. Library,
Drafts, and a Zustand-backed store are wired end-to-end against temporary
mock data. The runtime, extension, and shared contracts are being designed
alongside this work.

## Surfaces in this package

- **Home** — operational command center, recent captures, follow-up drafts.
- **Library** — captured conversation memory (Gmail, Telegram Desktop).
- **Conversation detail** — thread timeline, follow-up composer, context
  panel.
- **Drafts** — 3-pane writing workspace (alternatives, editor, context).
- **Connectors / Search / Settings / Diagnostics** — runtime-backed pages for
  local ingest, full-text search, model selection, and runtime status.

## Develop

From this directory:

```bash
vp install
vp check
vp dev
```

`vp` is the Vite+ unified CLI. See `AGENTS.md` for the full workflow,
including `vp check` (format + lint + typecheck) and `vp run build`.

## Package layout

```text
desktop/
  electron/         main + preload
  src/
    components/     page components and shared UI helpers
    layouts/        app shell
    lib/            contracts, navigation, runtime client
    routes/         thin page wrappers
    state/          client UI state
    styles/         Tailwind 4 + shadcn tokens
  public/           static assets
```

## Telegram connector

The Telegram connector is a MTProto user-client integration. It uses
`api_id` / `api_hash` from `my.telegram.org`, not a `@BotFather` bot token.
