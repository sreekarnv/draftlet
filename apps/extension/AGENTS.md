# AGENTS.md

Extension React/UI guidance:

- Preserve extension boundaries: content scripts stay lightweight, background coordinates browser concerns, and the side panel owns the primary drafting workflow.
- Do not keep growing large side panel or popup React files. Extract focused components, hooks, helpers, and small stores when adding non-trivial UI behavior.
- Prefer shared UI primitives from `packages/shared` when a component or token should align with desktop UI. Keep shared code free of browser-extension APIs.
- Use local state for local controls only. For cross-component side panel or popup UI state, prefer the repo-standard small store approach from root guidance.
- Use `react-hook-form` for non-trivial extension forms.
- Use React Router only if an extension surface develops real page/view boundaries; do not add routing for simple local tabs.
