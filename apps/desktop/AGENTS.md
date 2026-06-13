# AGENTS.md

Desktop React/UI guidance:

- Desktop owns setup, runtime lifecycle, settings, diagnostics, logs, and advanced controls. Keep those workflows separate from browser-specific extension concerns.
- Do not keep growing large desktop route/page files. Route files should compose feature components and move detailed rendering, helpers, form logic, and state orchestration into focused modules.
- Prefer shared UI primitives from `packages/shared` when desktop controls should align with extension UI. Keep shared code free of Electron IPC and desktop-only runtime APIs.
- Use `react-hook-form` for non-trivial setup, settings, diagnostics, and runtime configuration forms.
- Use Zustand, or the repo-standard small store if it changes, for cross-component desktop UI/app state. Do not duplicate durable runtime state in UI stores.
- Use React Router for real desktop page/view boundaries such as setup, runtime, diagnostics, help, and future settings pages.
