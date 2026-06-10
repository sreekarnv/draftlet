# AGENTS.md

You are working on Draftlet.

Draftlet is a local-first browser drafting assistant with:
- a browser extension
- a desktop app
- a local runtime/daemon
- shared contracts and UI primitives

The current implementation is a POC. Treat it as a base to learn from, not as architecture that must be preserved.

## Product direction

Draftlet v2 should behave like a browser-native assistant with a local runtime.

The webpage must not own the Draftlet workflow.

The page is only responsible for:
- lightweight context capture
- editable surface detection
- small inline Draftlet affordances
- best-effort insertion of approved drafts back into the page

The primary Draftlet experience belongs in privileged surfaces:
- extension side panel
- extension popup
- desktop app
- local runtime/daemon

## Core product goals

- generate high-quality reply drafts from selected or detected context
- support thread-aware drafting instead of one-shot stateless generation
- allow follow-up instructions like:
  - make this longer
  - make this warmer
  - answer all their questions
  - make this more formal
  - keep my wording but improve clarity
- keep the user in control of insertion and final edits
- work reliably with a local runtime

## Non-goals

- do not turn the content script into the main app
- do not build large floating overlays as the primary UX
- do not let the webpage directly own the local backend connection model
- do not overengineer with generic frameworks or enterprise-style abstractions

## Architecture principles

- Do not overengineer.
- Prefer explicit modules and understandable flow.
- Prefer small services and thin orchestration layers.
- Use typed contracts for cross-boundary communication.
- Keep extension, desktop, and runtime responsibilities separate.
- Avoid duplicate state across content script, popup, side panel, and desktop.
- Keep business logic out of content scripts.
- Do not silently invent new architecture patterns.
- Avoid large, unrelated refactors in a single task.
- When changing architecture, update the docs.

## Default responsibility split

### Content script
Responsible for:
- page integration
- selection capture
- editable target detection
- lightweight inline affordances
- insertion into the page
- relaying messages to extension-owned surfaces

Not responsible for:
- business logic
- model orchestration
- session ownership
- thread management
- persistence logic
- global app state

### Extension service worker / background
Responsible for:
- command routing
- tab/session coordination
- permissions and capability checks
- bridge orchestration to runtime or desktop
- shared state bootstrapping where appropriate

Not responsible for:
- heavy UI rendering
- page DOM operations
- large business workflows that belong in runtime

### Side panel
Responsible for:
- primary Draftlet workspace
- thread view
- generated drafts
- follow-up chat-style refinement
- user controls for tone, length, and coverage
- session-aware drafting UX

### Popup
Responsible for:
- quick actions
- status
- shortcuts
- entry point into the side panel

Not responsible for:
- full drafting workflows
- complex thread management

### Desktop app
Responsible for:
- onboarding
- runtime setup
- tray behavior
- settings
- diagnostics/logs
- advanced controls
- future background capabilities

### Local runtime / daemon
Responsible for:
- model access
- prompt building
- streaming generation
- persistence for sessions/threads/turns/preferences
- future retrieval or enrichment features if needed

## Product rules

- Generated replies must scale with source complexity.
- Long or multi-point emails must not receive shallow acknowledgment replies.
- The system should support thread-aware refinement over one-shot generation.
- The side panel should be the main drafting surface.
- The desktop app should own setup, diagnostics, runtime lifecycle, and advanced controls.
- Inline UI on pages must stay lightweight and unobtrusive.

## Required behavior before coding

For every non-trivial task:
1. Restate the goal.
2. List files likely to change.
3. List files that must not change.
4. State assumptions.
5. State risks.
6. Then implement only the requested scope.

If the task is architecture-heavy:
- inspect the existing code first
- propose a plan before changing code
- keep the migration path realistic

If the task is implementation-heavy:
- keep the diff tightly scoped
- avoid unrelated cleanup
- reuse existing conventions unless the task explicitly changes them

## Code change rules

- Do not introduce repository patterns.
- Do not add dependency injection frameworks.
- Do not add generic pipeline abstractions.
- Do not add dependencies unless clearly justified.
- Do not move many unrelated files just to appear “clean”.
- Do not rewrite working code without a clear migration reason.
- Do not duplicate message contracts in multiple places.
- Do not couple UI state to DOM state unnecessarily.

## State and domain expectations

The system should move toward a domain model with concepts like:
- WorkspaceSession
- ConversationThread
- Turn
- DraftVariant
- GenerationRun for runtime-owned execution control, lease freshness, cancellation intent, and stale-run reconciliation
- user actions/events

When implementing features, prefer aligning with these concepts instead of inventing one-off structures.

## Documentation expectations

When architecture or boundaries change, update or create:
- ARCHITECTURE.md
- BOUNDARIES.md
- EVENTS_AND_CONTRACTS.md
- UI_PRINCIPLES.md
- PHASE_PLAN.md

## Testing expectations

Prefer targeted tests for:
- message contracts
- state transitions
- prompt-building rules
- streaming behavior
- insertion behavior
- critical failure/retry paths

## Skills

Use the relevant skill file before making decisions in these areas:
- draftlet architecture
- extension surfaces
- UI system
- desktop/runtime boundaries
- FastAPI daemon design
- contracts and events
- migration rules

If multiple skills apply, follow the most specific one for the area being changed.
