# Draftlet Current State and Cleanup Notes

This document describes the current Draftlet architecture and the small set of cleanup items that are still open. It is not a migration plan — the architecture documented in [architecture.md](architecture.md), [boundaries.md](boundaries.md), and [events-and-contracts.md](events-and-contracts.md) is the current state.

## Current state

Draftlet runs locally on the developer's machine and is composed of six surfaces:

- a browser extension with a content script, a background service worker, a side panel workspace, and a popup
- an Electron desktop companion for first-run setup, tray-first runtime lifecycle, model settings, diagnostics, logs, and explicit quit behavior
- a local FastAPI server for Ollama streaming, runtime-owned model metadata/selection, prompt building, deterministic context compaction, response parsing, and SQLite persistence
- shared typed contracts in `packages/shared/src/contracts/` across the extension, desktop, and runtime boundaries
- a local SQLite database (via Alembic migrations) for sessions, threads, turns, draft variants, generation runs, preferences, and bounded browser recapture diagnostics
- Ollama, installed and run separately by the user

The runtime owns the `WorkspaceSession` / `ConversationThread` / `Turn` / `DraftVariant` / `GenerationRun` data model. It also owns selected model preference for generation and exposes Ollama model state through `/models/ollama`. `gemma3:4b` is the default recommendation, `qwen2.5:7b` is the power-user recommendation, and `llama3.2:3b` is the low-end fallback recommendation; selection is not hard-locked to installed models. Prompt building remains in FastAPI and now includes tone modes, follow-up/refinement instructions, source-complexity guidance, and deterministic context compaction that preserves explicit questions, names, dates, commitments, asks, and recent thread context before older context.

After first-run setup is marked complete, the desktop companion starts hidden with tray controls only. Closing a desktop window hides it; quitting is explicit through the tray. The tray exposes runtime status, settings, diagnostics, restart runtime, stop runtime, and quit actions. Runtime startup still uses `uv run uvicorn` in development and the bundled server executable in packaged builds.

Workshop is the primary drafting surface and is currently implemented by the extension side panel. The side panel keeps runtime snapshots under an explicit runtime projection and keeps Workshop-only state, including tone/view controls, selected thread/variant IDs, draft edit buffers, loading/error display state, and insertion progress/trail display, separately under UI state. Zustand remains deferred until the side panel has cross-component state pressure that justifies a store dependency. Insertion is best-effort page integration owned by the content script; Workshop's `Insert` / `Use` action owns the full target recovery chain (cached target → arm listener → activate tab → await capture → focus, restore selection, and insert). A `DRAFTLET_DEBUG_INSERTION=1` env var gates the popup's recapture diagnostics surface for dev-only debugging. The Command Surface MVP is a `Ctrl+Shift+D` Shadow DOM page affordance for fast context capture, draft generation, editing, cancellation, and insertion. It has only temporary overlay state and uses the existing background/runtime generation and content-script insertion paths; it is not the primary drafting UX.

## Open cleanup notes

The following items are known follow-ups. Each one is small, scoped, and intentionally left for a future change.

- **`DRAFTLET_DEBUG_INSERTION` dev gate.** The popup's recapture diagnostics section (label, Send to desktop button, Copy button, and the `Loading...` state) is hidden when the env var is unset. The default user flow shows only the runtime pill and a Refresh button. Documented in [troubleshooting.md](../troubleshooting.md) and tested in `apps/extension/tests/ui/popup.test.ts`.
- **`INSERTION_IN_PROGRESS` extension-only state.** The content script sends `draftlet:insertion-in-progress` fire-and-forget right after installing the arm listener for the Insert/Use chain; the side panel uses it only to flip the pending UI state immediately. `InsertionResult.status` was deliberately not extended with an `in_progress` value.
- **Clip-arm timeout.** The arm listener waits up to `INSERT_ARM_TIMEOUT_MS = 10000` for a focused editable. On timeout, the side panel attempts `navigator.clipboard.writeText`; if the copy succeeds it appends the "Draftlet could not find a compose field, so it copied the draft." trail item, otherwise "Draftlet could not find a compose field. Use Copy and paste manually." `appendTrail` dedupes identical trailing items so rapid retries cannot stack duplicate warnings.
- **Recapture background contract retained for compat.** `handleRecaptureInsertionTarget` and `handleActivateRecaptureTab` remain in `apps/extension/core/background/insertion-coordinator.ts` and are routed in `message-router.ts`. The side panel's user-facing Recapture button was removed; the background handlers are kept for integration tests and for any future restore-via-recapture flow. Full test coverage lives in `apps/extension/tests/core/background/insertion-coordinator.test.ts`.
- **`favorites` migration-compat safety net.** The `last_panel_view='favorites'` saved preference from earlier Draftlet versions is gracefully ignored by `isPanelView` in `apps/extension/core/storage.ts` and falls back to `'replies'`. The test in `apps/extension/tests/core/storage.test.ts` locks this behavior. The `favorites` table itself was removed by Alembic migration `0002_drop_favorites.py`; migration history stays intact.
- **Alembic migrations are historical and stay.** Migrations `0001_initial_persistence.py` through `0012_browser_recapture_diagnostics.py` are immutable history. The schema references (`favorites`, `legacy history`, etc.) in older migration files are not removed and not renamed.

## Scope discipline

A change to this area should usually do one of these:

- move one workflow's ownership to the right surface
- introduce one shared contract family
- delete one obsolete path after the replacement has been validated
- close one of the open cleanup notes above
- update one of the docs under [docs/](../) to match the current code

Do not combine unrelated UI polish, backend refactors, contract changes, dependency changes, and cleanup unless they are inseparable from the same migration step.

## Test hardening

Test coverage for the highest-risk orchestration paths is in place:

- **Extension side panel actions** — `apps/extension/tests/ui/sidepanel-actions.test.ts` covers draft generation start/cancel, refinement, history load and restore, refresh health, the `INSERTION_IN_PROGRESS` flow, the `armed_capture_timeout` clipboard fallback, and the appendTrail dedupe.
- **Extension background coordinators** — `apps/extension/tests/core/background/insertion-coordinator.test.ts`, `generation-coordinator.test.ts`, and `runtime-run-state.test.ts` cover the recapture background contract, the claim/run/start/cancel order, durable progress hydration, stream replay cursor handling, and stale-run reconciliation.
- **Extension content script** — `apps/extension/tests/core/content-script-insert-recovery.test.ts` covers the Insert/Use chain (cached target → arm listener → activate tab → await capture → supersede on concurrent insert) and asserts that the content script never reads `document.activeElement` directly for the recovery path.
- **Extension popup** — `apps/extension/tests/ui/popup.test.ts` covers the `DRAFTLET_DEBUG_INSERTION` gate and the `readDebugFlag` helper.
- **Runtime diagnostics** — `apps/server/tests/test_diagnostics_api.py` covers the bounded recapture diagnostics report contract and freshness window.
- **Desktop diagnostics** — `apps/desktop/tests/main/diagnostics.test.ts` and `diagnostics-export.test.ts` cover the desktop-side relay.

## Files not changed

- broad runtime rewrites beyond the focused model/prompt foundation.
- extension UI behavior.
- `apps/extension/core/recapture-diagnostics*.ts` and the `recordRecaptureDiagnostic` calls in `insertion-coordinator.ts` — the diagnostics data layer and the desktop relay consumer stay in place.
- Alembic migrations.
