# @draftlet/shared

Shared React/UI foundation for Draftlet-owned surfaces.

This package is for code that is genuinely reusable across the extension and desktop app:

- UI primitives and presentational helpers
- platform-neutral styling utilities and tokens
- shared typed contracts used across surfaces

Keep this package platform-neutral. Do not import browser extension APIs, Electron IPC, content-script DOM ownership, or runtime/server code here.

This first phase intentionally exports only a small surface. Existing app UI stays in place until a focused extraction has a real reuse case.

Use the package entrypoints by area:

- `@draftlet/shared` — root barrel; currently re-exports `tokens`, `ui`, and `utils`.
- `@draftlet/shared/ui` — presentational primitives: `Button`, `Badge`, `Card`, `Separator`.
- `@draftlet/shared/utils` — small helpers such as `cn` and the `ClassValue` type.
- `@draftlet/shared/tokens` — platform-neutral styling tokens (currently `draftletControlTokens`).
- `@draftlet/shared/contracts` — typed message contracts shared across surfaces, including the recapture diagnostics and generation-run maintenance diagnostics protocols.
