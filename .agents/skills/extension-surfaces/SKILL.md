---
name: Extension Surfaces
description: Rules for Draftlet browser extension surfaces, including content scripts, background coordination, side panel ownership, popup scope, typed messaging, and insertion reliability.
---

# Extension Surfaces

Use this skill for:
- content script work
- service worker/background changes
- side panel design/behavior
- popup behavior
- extension messaging
- page integration and insertion flows

## Goal

Keep browser integration reliable while maintaining clean responsibility boundaries between:
- content script
- service worker
- side panel
- popup

The webpage must never directly own Draftlet's local runtime connection or the drafting workflow.

## Surface roles

### Content script
Responsibilities:
- detect editable surfaces
- capture user selection
- inspect nearby page context when appropriate
- render a tiny inline trigger or marker
- perform insertion back into the page
- send structured messages to extension-owned surfaces

Rules:
- keep it a lightweight page integration layer
- optimize for reliability over cleverness
- isolate page-specific logic
- fail gracefully if DOM conditions change

Not responsible for:
- prompt building
- model calls
- runtime connection ownership
- thread/session lifecycle ownership
- large UI overlays

### Service worker / background
Responsibilities:
- route messages
- own command dispatch
- coordinate session bootstrap
- broker communication between surfaces and runtime
- keep browser-level state minimal and explicit

Rules:
- use typed messages
- centralize message routing
- log failures in a developer-friendly way
- avoid becoming a giant catch-all module

Not responsible for:
- heavy UI rendering
- page DOM operations
- prompt construction that belongs in the runtime
- persistence logic that belongs in the runtime

### Side panel
Responsibilities:
- main drafting workspace
- display sessions/threads/turns
- show streaming results
- allow refinement and regeneration
- allow controlled insertion back into page
- surface errors and retry actions clearly

Rules:
- prefer clear workflow over flashy UI
- treat this as the primary user-facing app in the extension
- support reopening/restoring state where possible

The side panel owns the extension's full drafting workflow: thread view, follow-up instructions, generated variants, user review, and explicit insertion actions.

### Popup
Responsibilities:
- quick status
- shortcut actions
- runtime availability summary
- "open Draftlet" entry point
- light settings or indicators only

Rules:
- keep popup simple
- avoid workflow duplication with side panel
- do not stuff primary drafting UX into popup

## Messaging rules

All cross-surface communication should use typed contracts.

Message types should be:
- explicit
- versionable
- narrow in purpose
- easy to trace

Prefer categories like:
- session events
- thread events
- draft generation events
- insertion events
- runtime connectivity events

Avoid:
- ad hoc string messages scattered around the codebase
- huge loosely typed payloads
- duplicating message shapes in multiple modules
- uncorrelated request/stream/response events

## Page integration rules

When interacting with pages:
- prefer minimal UI
- never assume the page is stable
- expect re-renders and DOM replacements
- treat editable targets as ephemeral
- revalidate target availability before insertion

For insertion:
- keep page adapters explicit
- support common cases first:
  - input
  - textarea
  - contenteditable
- add site-specific behavior only when justified
- preserve best-effort fallback behavior
- report failure clearly when insertion cannot be completed

## Session handling guidance

A browsing page may have:
- a current compose target
- a selected source block
- an active Draftlet session
- one or more threads over time

The content script may detect these, but should not own their long-lived lifecycle.

The extension should coordinate session identity.
The side panel should present session state.
The runtime should persist session state if needed.

The webpage should not hold connection state to the local runtime. Runtime access should flow through Draftlet-owned extension, desktop, or daemon layers.

## UI rules for extension surfaces

### Inline UI
- tiny
- unobtrusive
- context-aware
- should never feel like a full overlay app

### Side panel
- primary workspace
- full controls
- visible system state
- thread continuity
- room for follow-up prompts and variants

### Popup
- status-only mindset
- avoid dense layouts
- prioritize immediate clarity

## Reliability rules

Always design for:
- no active selection
- target disappeared
- page navigated
- page updated before insertion
- runtime unavailable
- desktop disconnected
- message timeout
- partial stream failure

Every critical flow should have:
- loading state
- error state
- retry path
- user-visible fallback

Retries should be explicit. Do not automatically insert, regenerate, or discard user edits without user intent.

## Do not

- do not put prompt logic in content scripts
- do not duplicate session state in every extension surface
- do not let the side panel and popup drift into separate apps
- do not rely on fragile DOM selectors without fallback logic
- do not use large floating overlays as the main Draftlet UX
- do not let webpage code directly manage Draftlet runtime connectivity
