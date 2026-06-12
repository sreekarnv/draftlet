# Events and Contracts

Draftlet crosses several boundaries: page to extension, extension surface to service worker, extension to runtime, desktop to runtime, and runtime to storage. Those boundaries need typed, explicit, traceable contracts.

This document is a practical convention guide, not a full protocol spec.

## Contract Principles

Contracts should be:
- narrow in purpose
- named clearly
- serializable
- easy to validate
- easy to trace in logs
- centralized in the shared contract location already used by the repo

Avoid ad hoc message payloads. If a shape crosses a boundary, define it once and reuse it.

## Event Categories

Use event categories that map to Draftlet product behavior:
- session lifecycle
- thread lifecycle
- turn lifecycle
- draft generation
- streaming generation
- insertion
- runtime connectivity
- desktop/runtime operations
- preferences
- diagnostics

Common event examples:
- session created
- session restored
- thread created
- thread updated
- turn created
- generation started
- generation delta received
- generation completed
- generation failed
- insertion requested
- insertion succeeded
- insertion failed
- runtime connected
- runtime disconnected

## Naming Guidance

Use names that make ownership and timing clear.

- Commands should read like requests: `draft.generate.requested`, `insertion.perform.requested`.
- Events should read like facts: `generation.started`, `generation.delta`, `generation.completed`, `insertion.failed`.
- Prefer stable namespaces over one-off strings.
- Use one naming convention for a boundary and keep it consistent.
- Include domain identifiers when an event belongs to a session, thread, turn, or draft.

Do not hide state transitions behind vague status strings like `done`, `ok`, or `update`.

## Request / Response Contracts

Every request/response contract should define:
- request type
- success response type
- failure response type
- required identifiers
- optional fields with clear meaning
- retry expectations when relevant

For long-running operations, include a correlation identifier so logs, UI state, and streaming events can be tied together.

A practical request shape usually includes:
- `request_id` or `correlation_id`
- relevant domain refs such as `session_ref` or `thread_ref`
- input payload
- options
- source metadata when needed

A practical response shape usually includes:
- `ok`
- result data on success
- structured error on failure
- identifiers needed to reconcile UI state

## Streaming Lifecycle

Streaming generation should have explicit lifecycle events. Do not make the UI infer lifecycle from arbitrary chunks.

Use events for:
- queued
- started
- delta or partial content
- completed
- failed
- cancelled

Each streaming event should include:
- `correlation_id`
- `session_id` when available
- `thread_id` when available
- `turn_id` when available
- `variant_id` when available
- sequence or ordering metadata when needed
- enough error metadata for retry or recovery on failure

The runtime should not emit UI-specific instructions. It should emit domain and transport events that the side panel can map into UI states.


## Extension WorkspaceSession And Thread Flow

The current v2 extension generation flow is intentionally transitional but now session- and thread-aware:
- content script sends `draftlet:launch-side-panel` with a page context snapshot
- service worker creates or updates a per-tab `WorkspaceSession`
- side panel restores the active tab session with `draftlet:get-current-workspace-session`
- service worker creates or reuses a session-backed `ConversationThread` when generation starts
- each generation creates a `Turn` on that thread
- runtime `WorkspaceSession` persistence carries the active routing ids for restore/reopen: `active_thread_id`, `active_turn_id`, and the currently live `active_run_id` when a runtime run is active
- turn lifecycle is durable on the `Turn` with explicit status, lifecycle timestamps, and bounded error metadata
- each live execution also claims a runtime `GenerationRun` lease tied to the session, thread, and turn; runtime enforces one fresh active lease per session and reconciles stale conflicts before allowing a new claim
- each streamed runtime reply is stored as a `DraftVariant` on the active turn
- runtime exposes `/domain/generation-runs/{run_id}/progress` as the bounded durable progress snapshot for a run; it includes the current `GenerationRun`, the thread snapshot when available, a replay cursor, and recent derived progress events
- runtime exposes `/replies/{run_id}/events` as a run-id subscription/replay feed for live or recently completed in-process executions
- service worker broadcasts `draftlet:workspace-session-updated` for session metadata and `draftlet:conversation-thread-updated` for thread snapshots
- service worker emits `draftlet:draft-generation-started`, `draftlet:draft-generation-completed`, and `draftlet:draft-generation-failed` as bounded transitional lifecycle notifications, while progress correlation and streamed variants reach extension surfaces through runtime progress/thread snapshots
- side panel renders thread snapshots as the primary thread workspace, grouped by `Turn` and `DraftVariant`
- side panel can cancel with `draftlet:cancel-draft-generation` using `sessionId` and `generationId`; background records runtime cancellation intent, aborts the browser-local fetch handle when present, and the runtime stream stops on the cancelled run state at the next bounded stream check
- insertion remains explicit: side panel sends `draftlet:insert-reply` with `sessionId`, service worker revalidates the bounded compose target when available, forwards approved text to the plausible live tab, and the content script performs best-effort DOM insertion

This keeps the webpage out of runtime transport and generation workflow ownership while preserving side-panel ownership of the workflow. Runtime persistence is the durable source for workspace sessions, threads, turns, variants, and generation run state.

## Runtime-Backed Session And Thread Flow

The current v2 generation flow is transitional but now uses durable runtime domain persistence:
- content script sends `draftlet:launch-side-panel` with a page context snapshot
- service worker coordinates the active browser tab and upserts a runtime `WorkspaceSession`
- side panel restores the active tab session with `draftlet:get-current-workspace-session`; background also asks runtime for the persisted session/thread snapshot when available
- initial generation creates or reuses a session-backed `ConversationThread`, creates a `Turn`, and streams replies through `/replies` with `generation_mode: initial`
- follow-up refinement uses `draftlet:start-draft-refinement`, appends a new `Turn` to the active persisted thread, and streams `/replies` with `generation_mode: refinement` plus the user instruction
- runtime-backed `Turn` lifecycle records queued, started, streaming, completed, failed, and cancelled states with timestamps and bounded error details
- runtime-backed `WorkspaceSession` records carry active routing metadata with `active_thread_id`, `active_turn_id`, and `active_run_id`; terminal or reconciled run state clears only the active run id while preserving the selected thread/turn context
- runtime-backed `GenerationRun` records make live execution explicit with `run_id`, `turn_id`, `session_id`, `thread_id`, status, lease owner, claim/heartbeat/release timestamps, bounded error metadata, and terminal-state protection against late stream updates
- service worker claims a runtime `GenerationRun` for the browser-provided run id before opening `/replies`; runtime `/replies` reuses that run, sends bounded heartbeat updates while the stream is active, and treats runtime conflicts as authoritative
- runtime stream handling updates and heartbeats the run while preserving `Turn` lifecycle state for side panel restore; cancellation is represented as runtime run state and checked by the active stream between upstream model chunks
- restore/startup can query execution state, hydrate `/domain/generation-runs/{run_id}/progress`, subscribe to `/replies/{run_id}/events` when the runtime still has a live in-process execution, reconcile stale active runtime runs, and mark incomplete live execution as interrupted without pretending model streaming is resumable after runtime restart
- runtime loads prior persisted thread context for refinement prompts, then persists each streamed reply as a `DraftVariant` for the turn
- runtime emits `draft_variant` SSE events with variant/thread/turn metadata and bounded event ids for in-process replay
- service worker rehydrates run progress and the active `ConversationThread` snapshot from runtime for streamed results and broadcasts `draftlet:conversation-thread-updated`; it no longer inserts streamed variants into extension-local thread state when runtime snapshot hydration misses an event
- service worker emits `draftlet:draft-generation-started`, `draftlet:draft-generation-completed`, and `draftlet:draft-generation-failed` as secondary lifecycle notifications during the transition
- side panel renders the restored thread workspace with chronological turns, grouped variants, and `isCurrent` / `accepted` state
- side panel requests domain-backed history with `draftlet:get-domain-history`; background reads `/domain/history` from the runtime
- side panel restores a selected history item with `draftlet:restore-domain-thread`; background hydrates the selected runtime session/thread snapshot and emits workspace/thread updates
- side panel can request `draftlet:set-current-draft-variant` or `draftlet:accept-draft-variant`; background patches runtime state and emits an updated thread snapshot
- refinement prompts prefer the accepted variant, then the current variant, then the latest prior turn variants as a compatibility fallback
- insertion remains explicit: side panel sends `draftlet:insert-reply` with `sessionId` and `variantId` when available; service worker checks `ComposeTargetRef` metadata, asks the content script to revalidate the target with `draftlet:revalidate-insertion-target`, and reports live/stale/unavailable status for fallback copy/manual use
- recapture after stale restore is explicit: side panel can send `draftlet:activate-recapture-tab` to bring a validated chosen tab forward, then sends `draftlet:recapture-insertion-target` with an optional chosen `tabId`; background binds reachable selected tabs, asks the content script to recapture or restore the focused compose target, and returns typed outcomes for tab acknowledgement, focus-required retry, unavailable tabs, stale targets, and successful recapture
- the side panel may keep a bounded, local recapture status trail for recent activation/recapture attempts; this is UI recovery context, not durable runtime history
- background keeps a bounded in-memory recapture diagnostics log for extension debugging; debug surfaces can query it with `draftlet:get-recapture-diagnostics`, and it must not include selected text or full page content
- the popup may display compact runtime status and recent recapture diagnostics, and may copy a bounded diagnostics report for debugging, but it must remain a quick status/debug surface and not duplicate side-panel drafting workflow
- desktop diagnostics may point users to extension-owned recapture diagnostics, but browser tab/content-script state stays in the extension until an explicit desktop-extension diagnostics bridge exists

Legacy runtime `Generation`/`Reply` persistence and `/history` are retired. Side-panel history and streaming now use domain-backed `WorkspaceSession` / `ConversationThread` / `Turn` / `DraftVariant` data end to end, with `GenerationRun` as the bounded durable execution lease for active/recoverable generation work. Current and accepted variant state is bounded to one variant per thread in this phase.

## Future Desktop-Extension Diagnostics Bridge

The first desktop-extension diagnostics transport is a bounded runtime relay:
- extension background owns the recapture diagnostics log
- extension popup can ask background to publish a privacy-bounded report to `/diagnostics/browser-recapture`
- runtime stores only the latest report in memory, records when it was received, and clears it after the bounded freshness window
- desktop reads the latest report through its normal main-process IPC and the runtime endpoint
- desktop can display the report or an expired-report state, but cannot mutate browser recapture state

The transitional shared contract lives in `shared/recapture-diagnostics-contract.ts`. Extension popup export and desktop diagnostics guidance must use that shared contract instead of defining parallel report shapes.

The bridge contract stays narrow and diagnostics-only:
- desktop requests the latest bounded recapture diagnostics report from the runtime relay
- extension remains the owner of browser tab, content-script, and focused compose target state
- extension returns serialized diagnostic entries using the same privacy-bounded report shape as popup copy
- desktop may display, export, or attach the report to operational diagnostics
- desktop must not mutate recapture state, activate tabs, retry recapture, or infer live DOM state

The bridge response should include only fields already safe for the popup diagnostics export:
- `id`
- `event`
- `level`
- `sessionId`
- `tabId`
- `status`
- `outcome`
- `reason`
- `message`
- `at`

Relay freshness metadata may include `receivedAt`, `stale`, and `staleAfterSeconds`. These fields describe the runtime-held report envelope, not live browser state.

The bridge response must not include selected text, generated draft text, full page content, DOM selectors, cookies, tokens, local runtime secrets, or raw exception objects.

The relay is intentionally non-durable. A future implementation can replace it with native messaging or another explicit channel, but it must keep the same privacy-bounded request/response contract or version it deliberately.

## Error Shape

Errors crossing boundaries should be structured and safe to show or log.

Prefer this shape:

```ts
type DraftletError = {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
  correlation_id?: string;
};
```

Use stable `code` values for program behavior. Use `message` for human-facing explanation. Keep `details` limited and avoid leaking raw internal exceptions into UI.

Retryable errors should be machine-readable so popup, side panel, desktop, and runtime clients can offer the right recovery path.

## Identifier Guidance

Use stable identifiers to keep cross-boundary state coherent.

- `session_id` identifies a WorkspaceSession.
- `thread_id` identifies a ConversationThread.
- `turn_id` identifies a Turn.
- `run_id` identifies a GenerationRun lease for one live execution attempt.
- `variant_id` identifies a DraftVariant.
- `compose_target_id` or equivalent identifies a captured editable target snapshot, not a permanently valid DOM node.
- `correlation_id` connects a request with logs, stream events, cancellation, retry, and final result.

DOM references should not cross long-lived boundaries as live objects. Send snapshots and refs instead.

## Suggested Shared Entities

The shared contracts should evolve around these entities:
- `SessionRef`
- `ThreadRef`
- `TurnRef`
- `DraftVariantRef`
- `ComposeTargetRef`
- `SourceSnapshot`
- `GenerationOptions`
- `RuntimeStatus`
- `InsertionResult`

These names can adapt to existing repo conventions, but the concepts should remain stable.

## Boundary Examples

Content script to service worker:
- selection captured
- compose target detected
- compose target revalidated
- insertion requested
- insertion succeeded or failed

Side panel to service worker:
- open or restore session
- request draft generation
- request follow-up refinement
- request insertion into active target
- mark draft variant current
- mark draft variant accepted

Extension to runtime:
- create or restore session
- create thread
- append turn
- generate draft variant
- stream generation events
- read or update preferences

Desktop to runtime:
- check health
- start or stop runtime
- inspect config
- read logs or diagnostics
- manage operational settings

## Anti-Patterns

Avoid:
- raw string literals as the only source of truth for message types
- duplicate schemas in extension, desktop, and runtime code
- arbitrary `any` payloads
- giant unstructured blobs
- payloads that mix UI state, transport state, and domain state
- per-surface error formats
- streaming protocols that only expose text chunks without lifecycle metadata
