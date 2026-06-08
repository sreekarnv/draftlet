# Draftlet Boundaries

This document answers: where should this code or feature live?

The hard rule is that the webpage must not own the Draftlet workflow. The page is only an integration point for context capture, editable target detection, small inline affordances, and best-effort insertion.

## Content Scripts

Put code in content scripts when it directly touches the webpage.

Content scripts own:
- page integration
- selection capture
- editable target detection
- nearby context capture when appropriate
- tiny inline triggers or markers
- insertion into inputs, textareas, and contenteditable surfaces
- page-specific adapter logic
- relaying structured messages to extension-owned surfaces

Content scripts do not own:
- business logic
- prompt building
- model calls
- runtime connection ownership
- persistence
- session or thread lifecycle
- global app state
- large floating app overlays

Treat DOM targets as ephemeral. Revalidate the target before insertion, expect page re-renders, and keep fallbacks visible to the user.

## Service Worker / Background

Put code in the service worker or background when it coordinates browser extension behavior.

The service worker/background owns:
- command routing
- typed message dispatch
- tab and window coordination
- per-tab/session bootstrapping
- extension permissions and capability checks
- bridge orchestration between extension surfaces and runtime/desktop
- lightweight browser-level state

It does not own:
- heavy UI rendering
- page DOM operations
- prompt construction
- durable domain persistence
- large drafting workflows that belong in the side panel or runtime

Keep it explicit. Avoid a giant background module that quietly becomes the application backend.

## Side Panel

Put code in the side panel when it is part of the primary drafting workflow.

The side panel owns:
- the main Draftlet workspace
- session and thread display
- source/context summary
- streaming draft display
- follow-up instructions
- tone, length, and coverage controls
- draft variants and comparison
- insertion, copy, and replace actions
- user-visible errors and retry controls

The side panel does not own:
- low-level page DOM logic
- direct webpage runtime connection logic
- runtime persistence internals
- hidden transport concerns that belong in coordination or runtime layers

The side panel should be the default destination for any workflow that takes more than a quick action.

## Popup

Put code in the popup when it is a compact entry point or status surface.

The popup owns:
- quick actions
- runtime availability summary
- shortcuts
- opening the side panel
- small browser-side settings or indicators

The popup does not own:
- full drafting workflows
- complex thread management
- long-form refinement UI
- duplicate side panel state

If a workflow needs history, comparison, follow-up instructions, or careful review, it belongs in the side panel.

## Desktop App

Put code in the desktop app when it is machine-local or operational.

The desktop app owns:
- first-run onboarding
- runtime setup
- checking local dependencies
- starting and stopping runtime processes
- tray behavior
- logs and diagnostics
- advanced settings
- update-oriented operational UX
- future background capabilities that are not page-specific

The desktop app does not own:
- webpage DOM behavior
- content script workflows
- per-page selection capture
- browser-side insertion
- the primary browser drafting workspace

Desktop may present runtime state, but it should not become a second Draftlet drafting app competing with the side panel.

## Runtime / Daemon

Put code in the runtime when it belongs to model access, generation, persistence, or local service behavior.

The runtime owns:
- model access
- prompt building
- generation orchestration
- streaming responses
- request validation
- service-level business rules
- persistence for sessions, threads, turns, drafts, and preferences
- runtime-scoped settings
- future retrieval or enrichment features

The runtime does not own:
- page DOM assumptions
- browser UI assumptions
- desktop renderer behavior
- extension-specific presentation state

FastAPI routes should validate input, call explicit services, and return typed responses. Prompt, storage, and streaming logic should not be scattered across routes.

## State Ownership

Keep one clear owner for each class of state.

- Page DOM state belongs to the content script and is ephemeral.
- Extension coordination state belongs in the service worker/background.
- Drafting workflow UI state belongs in the side panel.
- Durable session, thread, turn, draft, prompt, generation, and preference state should move toward runtime ownership.
- Machine-local operational state belongs in the desktop app.

Avoid mirrored mutable state across content script, popup, side panel, desktop, and runtime. Share identifiers, snapshots, and typed events instead.

## Messaging Ownership

Cross-surface communication must use typed contracts.

Use shared schemas for messages between:
- content script and service worker
- side panel and service worker
- popup and service worker
- extension and runtime
- desktop and runtime

The service worker should coordinate extension message routing. The runtime should expose stable request/response and streaming interfaces. No surface should invent ad hoc payloads for the same concept.

## Persistence Ownership

Persist only state with product value.

Runtime persistence should own:
- workspace sessions that must survive reloads or reconnects
- conversation threads
- turns
- draft variants
- generation preferences
- runtime-scoped settings

Extension storage can hold lightweight browser coordination state. Desktop storage can hold machine-local setup and operational preferences. Content scripts should not persist domain state.

## Anti-Patterns

Avoid these patterns:
- business logic in content scripts
- webpage code directly owning local runtime access
- duplicate long-lived state across content script, popup, side panel, desktop, and runtime
- popup becoming the main app
- large floating overlays becoming the primary product UX
- prompt building spread across extension UI code
- routes that mix validation, prompt construction, persistence, and streaming
- vague shared mutable state without a clear owner
