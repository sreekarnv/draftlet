# Draftlet Phase Plan

This plan moves Draftlet from the current POC toward v2 without broad rewrites. Each phase should be scoped, validated, and reversible where practical.

## Current State Summary

The current repo already has:
- a browser extension for page selection, UI, streaming, and insertion
- an Electron desktop companion for setup and runtime operations
- a local FastAPI server for prompt building, Ollama streaming, SSE responses, and persistence
- local setup and troubleshooting docs
- Draftlet-specific Codex skill files under `.agents/skills/`

The current implementation proves the product loop, but some boundaries are transitional. v2 should make ownership explicit and support thread-aware drafting rather than mostly one-shot generation.

## Target State Summary

The target v2 architecture has:
- content scripts as lightweight page integration only
- service worker/background as extension coordinator
- side panel as the primary drafting workspace
- popup as quick status and entry point
- desktop app as setup, tray, diagnostics, and runtime lifecycle owner
- local runtime as prompt, generation, streaming, persistence, and domain state owner
- shared typed contracts across all boundaries
- explicit WorkspaceSession, ConversationThread, Turn, and DraftVariant concepts

## Migration Principles

- Make small, coherent changes.
- Preserve working behavior while moving ownership.
- Avoid broad rewrites and unrelated cleanup.
- Introduce shared contracts before expanding cross-surface workflows.
- Keep transitional code obvious and close to the boundary it bridges.
- Delete old flows only after the replacement path is validated.
- Update docs whenever ownership changes.

## Phase 0: Docs and Architecture Alignment

### Objective
Align human docs, Codex skills, and implementation tasks around the same v2 target.

### Likely Areas / Files Affected
- `docs/architecture/architecture.md`
- `docs/architecture/boundaries.md`
- `docs/architecture/events-and-contracts.md`
- `docs/architecture/phase-plan.md`
- `docs/ui/ui-principles.md`
- `.agents/skills/*/SKILL.md` only when skill guidance itself is wrong or stale

### What Should Not Change Yet
- application behavior
- runtime APIs
- extension message flows
- persistence schemas
- UI implementation

### Exit Criteria
- the five v2 docs exist and are internally consistent
- skill files and human docs do not contradict each other
- future tasks can cite where a feature belongs

### Risks
- docs may describe a cleaner target than the current code supports
- legacy docs may overlap with v2 docs until later cleanup

## Phase 1: Connection Ownership and Extension/Runtime Boundary

### Objective
Ensure local runtime access is owned by Draftlet-controlled layers, not webpage code or scattered UI helpers.

### Likely Areas / Files Affected
- extension service worker/background routing
- extension runtime client helpers
- shared contract definitions
- runtime health/status endpoints if needed
- desktop runtime status integration

### What Should Not Change Yet
- full session/thread persistence model
- side panel workflow redesign
- desktop onboarding redesign
- broad server refactors

### Exit Criteria
- content scripts no longer directly own runtime connection behavior
- extension surfaces use typed messages for runtime operations
- runtime unavailable, timeout, and retry paths are explicit
- existing generation and insertion flows still work

### Risks
- breaking the current streaming path
- duplicating connection state across popup, side panel, and background
- hiding errors behind generic connection failures

## Phase 2: Session/Thread/Turn Domain Model

### Objective
Introduce explicit domain concepts for WorkspaceSession, ConversationThread, Turn, and DraftVariant.

### Likely Areas / Files Affected
- shared schemas/contracts
- runtime schemas and storage
- prompt-building services
- generation history persistence
- extension session coordination
- targeted tests for state transitions and contracts

### What Should Not Change Yet
- large UI redesign
- removal of existing history or fallback flows
- advanced retrieval or memory features

### Exit Criteria
- shared refs exist for session, thread, turn, and draft variant concepts
- runtime can persist or reconstruct meaningful drafting history
- generation requests can include thread context and follow-up instructions
- one-shot generation still works through a compatibility path if needed

### Risks
- over-modeling before workflows need it
- duplicating old history records and new domain records without a migration story
- making simple draft generation harder to debug

## Phase 3: Side Panel Becomes Primary Workflow

### Objective
Move the main drafting experience into the side panel: thread view, streaming drafts, follow-up refinement, variants, review, and insertion controls.

### Likely Areas / Files Affected
- side panel React UI
- extension message contracts
- content script insertion bridge
- shared UI primitives and tokens
- runtime streaming/event handling

### What Should Not Change Yet
- desktop operational scope
- unrelated popup settings
- low-level page adapters beyond what insertion requires

### Exit Criteria
- side panel can create or restore a workspace session
- side panel displays thread-aware draft generation and refinement
- user can compare or review variants before insertion
- insertion remains explicit and user-controlled
- popup remains a quick entry/status surface

### Risks
- recreating a toy chat UI instead of a writing workspace
- overloading popup with duplicated workflow state
- losing user edits during streaming or regeneration
- making insertion brittle by coupling UI state to live DOM state

## Phase 4: Desktop/Runtime Operational Separation

### Objective
Clarify desktop and runtime responsibilities around setup, tray behavior, diagnostics, logs, config, and lifecycle.

### Likely Areas / Files Affected
- desktop main/preload/renderer boundaries
- runtime health/config/status routes
- desktop settings and diagnostics UI
- packaged runtime startup behavior
- setup and troubleshooting docs

### What Should Not Change Yet
- browser drafting workflow ownership
- content script page integration
- side panel thread UX unless required by runtime status

### Exit Criteria
- desktop clearly owns setup, tray, diagnostics, and runtime lifecycle controls
- runtime exposes stable status/config surfaces
- extension can report runtime availability without owning desktop concerns
- failure states are clear for runtime missing, crashed, stale, or misconfigured cases

### Risks
- desktop becoming a second main drafting app
- runtime lifecycle behavior becoming hidden or surprising
- operational settings being split across desktop, extension, and runtime without ownership

## Phase 5: Cleanup, Deletion, and Hardening

### Objective
Remove obsolete POC paths, harden failure handling, and consolidate docs after replacement flows are validated.

### Likely Areas / Files Affected
- old extension helpers and UI paths
- obsolete message contracts
- runtime compatibility endpoints or adapters
- legacy docs such as current-state architecture notes
- targeted tests and manual QA checklists

### What Should Not Change Yet
- working fallback insertion behavior without replacement
- user-visible workflows that have not been validated in v2 form
- unrelated package structure

### Exit Criteria
- duplicate session, thread, or draft state owners are removed
- obsolete message shapes are deleted or explicitly deprecated
- failure/retry paths are tested for critical flows
- docs describe current behavior and not only the target
- broad transitional compatibility code is gone

### Risks
- deleting fallback behavior too early
- leaving dead code because ownership is unclear
- hardening only happy paths while insertion and streaming failures remain fragile

## Scope Discipline

A migration PR should usually do one thing:
- move one responsibility to the right owner
- introduce one shared contract family
- add one domain concept and its tests
- replace one runtime bridge
- delete one obsolete flow after validation

Do not combine UI polish, backend refactors, contract changes, dependency changes, and cleanup unless they are inseparable from the same migration step.
