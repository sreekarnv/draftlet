---
name: Draftlet Architecture
description: System-boundary and ownership rules for Draftlet across content scripts, extension surfaces, desktop app, and local runtime, including domain direction and migration guidance.
---

# Draftlet Architecture

Use this skill for:
- repo-wide architecture changes
- cross-surface feature planning
- deciding where functionality belongs
- defining module boundaries
- phased refactors

## Purpose

Draftlet is not just a browser overlay. It is a system with multiple surfaces and a local runtime.

This skill defines where responsibilities belong and which architectural patterns to prefer.

## High-level system model

Draftlet consists of:

1. Page integration layer
   - content script
   - editable target detection
   - selection capture
   - inline affordances
   - insertion back into the page

2. Extension application layer
   - service worker / background
   - side panel
   - popup
   - extension-level coordination

3. Local application layer
   - desktop app
   - local runtime/daemon
   - persistence
   - model orchestration
   - diagnostics

## Golden rule

The webpage must not own the Draftlet workflow.

The webpage is only for:
- capture
- insertion
- minimal local affordances

The main workflow belongs to Draftlet-owned surfaces: side panel, popup, desktop app, and local runtime. The side panel is the primary drafting surface.

## Responsibility map

### Content script
Use for:
- detecting editable areas
- reading selection or nearby context
- creating a tiny inline affordance
- inserting user-approved text into the page
- reporting page context to the extension

Do not use for:
- main application state
- prompt building
- model calls
- runtime connection ownership
- persistence logic
- thread ownership
- complex orchestration

### Service worker / background
Use for:
- routing commands
- coordinating per-tab or per-page sessions
- bridging extension surfaces to local runtime
- capability checks
- shared extension-level lifecycle handling

Do not use for:
- rendering complex UI
- storing complex logic that belongs in runtime
- page DOM manipulation
- long-lived domain persistence

### Side panel
Use for:
- the main drafting experience
- session/thread display
- streaming draft results
- follow-up generation
- refinement controls
- variant comparison
- review before insertion

Do not use for:
- low-level page DOM logic
- hidden transport concerns that should live in service/runtime layers
- direct webpage runtime connection logic

### Popup
Use for:
- lightweight quick actions
- status and diagnostics entry points
- opening the side panel
- a compact summary of Draftlet state

Do not use for:
- full thread workflows
- dense multi-step drafting experiences

### Desktop app
Use for:
- setup and onboarding
- runtime install/start/stop
- tray behavior
- advanced settings
- logs and diagnostics
- future global features

Do not use for:
- page-specific UI
- browser-only state
- content-script-specific behavior
- competing with the side panel as the drafting workspace

### Runtime / daemon
Use for:
- prompt building
- model access
- streaming generation
- persistence
- thread/session storage
- future enrichment/retrieval

Do not use for:
- page DOM assumptions
- browser UI assumptions
- hard-coded extension UI behavior

## State ownership

Keep one clear owner for each class of state.

- Page DOM state belongs to the content script and must be treated as ephemeral.
- Extension coordination state belongs in the service worker/background.
- Drafting workflow state belongs in the side panel UI, backed by runtime state where persistence matters.
- Session, thread, turn, draft, prompt, preference, and generation history state should move toward runtime ownership.
- Desktop owns machine-local operational state such as setup, tray, diagnostics, and runtime lifecycle.

Avoid mirrored mutable state across content script, popup, side panel, desktop, and runtime. Share identifiers and typed events instead.

## Preferred architectural style

- explicit modules
- small services
- typed boundaries
- straightforward orchestration
- predictable data flow

Prefer:
- route -> service -> storage
- surface -> typed message -> coordinator -> runtime
- pure helpers for domain logic
- schema-first contracts

Avoid:
- deep inheritance
- generic managers/factories everywhere
- abstract pipelines for simple flows
- hidden side effects
- shared mutable state without clear ownership
- dependency injection frameworks or enterprise patterns for simple local flows

## Where new features should go

Use this decision guide:

### If it touches the webpage DOM
Put it in content script or page integration helpers.

### If it coordinates extension surfaces or browser lifecycle
Put it in service worker / background.

### If it is the main user workflow
Put it in the side panel.

### If it is quick status or launch UX
Put it in the popup.

### If it is runtime, setup, logging, or machine-local behavior
Put it in desktop.

### If it is model generation, persistence, streaming, or prompt logic
Put it in runtime/daemon.

## Domain direction

Features should evolve toward these core entities:

### WorkspaceSession
Represents a Draftlet workspace tied to a browsing context.

Suggested attributes:
- session_id
- tab_id
- window_id
- page_url
- page_title
- compose_target metadata
- created_at
- updated_at
- status

Ownership should be coordinated by the extension and persisted by the runtime when it must survive reloads or restarts.

### ConversationThread
Represents a drafting thread within a workspace.

Suggested attributes:
- thread_id
- session_id
- source snapshot
- contextual metadata
- draft history
- thread status

This is the unit for thread-aware drafting and follow-up instructions.

### Turn
Represents one user/model exchange.

Suggested attributes:
- turn_id
- thread_id
- source input
- user instruction
- model output
- edited output
- timestamps
- generation metadata

Turns should preserve the difference between source context, user instruction, generated output, and user-edited output.

### DraftVariant
Represents a specific generated draft.

Suggested attributes:
- variant_id
- turn_id
- tone
- length
- coverage mode
- content
- rank/order
- accepted/rejected status

Variants should make comparison and controlled insertion straightforward.

## Cross-cutting concerns

Plan for:
- retries
- partial streaming failures
- page target disappearing
- stale selections
- side panel reopening
- runtime unavailable
- desktop disconnected

These should be explicit states, not hidden assumptions.

## Documentation rules

When changing architecture:
- update the relevant docs
- state what moved
- state what remains transitional
- note migration boundaries clearly

Relevant docs may include:
- ARCHITECTURE.md
- BOUNDARIES.md
- EVENTS_AND_CONTRACTS.md
- UI_PRINCIPLES.md
- PHASE_PLAN.md

## Do not

- do not let content scripts become mini applications
- do not let the popup become the main workspace
- do not put business logic in many surfaces at once
- do not introduce a greenfield fantasy architecture with no migration path
- do not create ambiguous ownership of session state
- do not let the webpage directly own runtime connectivity or Draftlet workflow state
