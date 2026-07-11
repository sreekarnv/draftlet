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
- **Connectors / Search / Settings / Diagnostics** — placeholder pages
  pending the runtime wiring.

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
    lib/            contracts, navigation, runtime-side mock data
    routes/         thin page wrappers
    state/          Zustand store (persist to localStorage)
    styles/         Tailwind 4 + shadcn tokens
  public/           static assets
```

## Known temporary bits

- `src/lib/mock-data.ts` is hard-coded fixture data. The header comment
  explicitly says it is to be replaced when the runtime is wired.
- `src/state/draftlet-store.ts` persists to `localStorage` under
  `draftlet:v1`. When the runtime lands, the same store will be
  hydrated from the FastAPI daemon instead.
- The four `/connectors`, `/search`, `/settings`, `/diagnostics` routes
  render a shared `ShellPlaceholder` until their pages are built.
