# @draftlet/shared

Shared React/UI foundation for Draftlet-owned surfaces.

This package is for code that is genuinely reusable across the extension and desktop app:

- UI primitives and presentational helpers
- reusable React hooks
- form helpers for shared form patterns
- small state helpers for cross-component UI state
- platform-neutral styling utilities and tokens

Keep this package platform-neutral. Do not import browser extension APIs, Electron IPC, content-script DOM ownership, or runtime/server code here.

This first phase intentionally exports only a small surface. Existing app UI stays in place until a focused extraction has a real reuse case.

Use the package entrypoints by area:

- `@draftlet/shared` for the smallest common surface
- `@draftlet/shared/ui` for shared UI primitives
- `@draftlet/shared/hooks` for reusable React hooks
- `@draftlet/shared/forms` for shared form helpers
- `@draftlet/shared/state` for platform-neutral UI state helpers
- `@draftlet/shared/tokens` for shared styling tokens
- `@draftlet/shared/utils` for small utilities such as `cn`

Current shared UI primitives:

- `Button`
- `Badge`
- `Card`
- `Separator`

Desktop and extension can wrap these primitives locally to preserve surface-specific density and defaults.
