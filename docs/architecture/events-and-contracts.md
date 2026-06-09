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
- each streamed runtime reply is stored as a `DraftVariant` on the active turn
- service worker broadcasts `draftlet:workspace-session-updated` for session metadata and `draftlet:conversation-thread-updated` for thread snapshots
- service worker emits `draftlet:draft-generation-started`, `draftlet:draft-generation-completed`, and `draftlet:draft-generation-failed` for generation lifecycle, while streamed variants reach extension surfaces through `draftlet:conversation-thread-updated` snapshots
- side panel renders thread snapshots as the primary thread workspace, grouped by `Turn` and `DraftVariant`
- side panel can cancel with `draftlet:cancel-draft-generation` using `sessionId` and `generationId`
- insertion remains explicit: side panel sends `draftlet:insert-reply` with `sessionId`, service worker forwards it to the session tab, and the content script performs best-effort DOM insertion

This keeps the webpage out of runtime transport and generation workflow ownership while preserving side-panel ownership of the workflow. Runtime persistence is the durable source for workspace sessions, threads, turns, and variants.
## Runtime-Backed Session And Thread Flow

The current v2 generation flow is transitional but now uses durable runtime domain persistence:
- content script sends `draftlet:launch-side-panel` with a page context snapshot
- service worker coordinates the active browser tab and upserts a runtime `WorkspaceSession`
- side panel restores the active tab session with `draftlet:get-current-workspace-session`; background also asks runtime for the persisted session/thread snapshot when available
- initial generation creates or reuses a session-backed `ConversationThread`, creates a `Turn`, and streams replies through `/replies` with `generation_mode: initial`
- follow-up refinement uses `draftlet:start-draft-refinement`, appends a new `Turn` to the active persisted thread, and streams `/replies` with `generation_mode: refinement` plus the user instruction
- runtime loads prior persisted thread context for refinement prompts, then persists each streamed reply as both a legacy `Reply` and a new `DraftVariant` for the turn
- runtime emits `draft_variant` SSE events with variant/thread/turn metadata
- service worker maps each streamed result into the active `ConversationThread` snapshot and broadcasts `draftlet:conversation-thread-updated`
- service worker emits `draftlet:draft-generation-started`, `draftlet:draft-generation-completed`, and `draftlet:draft-generation-failed` for generation lifecycle state
- side panel renders the restored thread workspace with chronological turns, grouped variants, and `isCurrent` / `accepted` state
- side panel requests domain-backed history with `draftlet:get-domain-history`; background reads `/domain/history` from the runtime
- side panel restores a selected history item with `draftlet:restore-domain-thread`; background hydrates the selected runtime session/thread snapshot and emits workspace/thread updates
- side panel can request `draftlet:set-current-draft-variant` or `draftlet:accept-draft-variant`; background patches runtime state and emits an updated thread snapshot
- refinement prompts prefer the accepted variant, then the current variant, then the latest prior turn variants as a compatibility fallback
- insertion remains explicit: side panel sends `draftlet:insert-reply` with `sessionId` and `variantId` when available; service worker forwards approved text to the session tab, and the content script performs best-effort DOM insertion

Old runtime `Generation`/`Reply` persistence remains as a bounded server-side compatibility bridge for legacy APIs, but extension surfaces no longer render flat `ReplyItem` data or use the retired in-page panel path. Side-panel history and streaming browse domain-backed `WorkspaceSession` / `ConversationThread` / `Turn` / `DraftVariant` data. Current and accepted variant state is bounded to one variant per thread in this phase.

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
