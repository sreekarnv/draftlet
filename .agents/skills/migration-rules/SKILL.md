---
name: Migration Rules
description: Rules for migrating Draftlet from the current POC toward v2 architecture through phased, scoped, and deliberate changes.
---

# Migration Rules

Use this skill for:
- phased migration from the current POC to Draftlet v2
- replacing architecture deliberately
- transitional code decisions
- deletion and cleanup decisions
- scope control during refactors

## Goal

Move Draftlet toward a browser-native assistant with a local runtime while preserving working behavior during the transition.

The current POC is a base to learn from, not architecture that must be preserved.

## Migration principles

- Make small, coherent changes.
- Keep behavior working while moving ownership to the right surface.
- Prefer explicit transitional seams over hidden compatibility hacks.
- Delete obsolete code only after the replacement path is exercised.
- Update architecture docs when boundaries change.
- Avoid broad cleanup in the same diff as behavior migration.

## Direction of travel

Draftlet v2 should move toward:
- content scripts as lightweight page integration
- side panel as the primary drafting workflow
- popup as status and quick actions
- service worker/background as browser coordination
- desktop as setup, tray, diagnostics, and runtime lifecycle
- local runtime as prompt, generation, streaming, persistence, and thread state owner

The webpage must not own Draftlet workflow state or runtime connectivity.

## Transitional code rules

Transitional code is allowed when it keeps migration realistic, but it must be obvious.

When adding transitional code:
- name what it bridges
- keep it close to the old/new boundary
- avoid making it a reusable framework
- leave a short comment only if the removal path is not obvious
- avoid spreading compatibility logic across multiple surfaces

## Deletion rules

Delete old code when:
- the new owner handles the behavior
- tests or manual validation cover the replacement
- no active surface still imports or depends on it
- documentation no longer describes the old path as current

Do not delete working fallback behavior until the replacement has equivalent reliability for page capture, insertion, runtime unavailability, and retry flows.

## Scope control

A migration diff should usually do one of these:
- move ownership of one workflow
- introduce one shared contract
- replace one page/runtime bridge
- extract one prompt or persistence responsibility
- remove one obsolete path after replacement

Avoid combining unrelated UI polish, backend refactors, dependency changes, and contract migration in one change.

## Preserve behavior

Before changing ownership, identify how the current POC handles:
- context capture
- editable target detection
- insertion
- draft generation
- retry/failure handling
- side panel or popup state
- runtime connectivity

Keep the user-visible path intact or clearly document the temporary gap.

## Documentation expectations

When a migration changes architecture or boundaries, update or create the relevant docs:
- ARCHITECTURE.md
- BOUNDARIES.md
- EVENTS_AND_CONTRACTS.md
- UI_PRINCIPLES.md
- PHASE_PLAN.md

State:
- what moved
- what still uses the old path
- what can be removed later
- what validation was performed

## Do not

- do not rewrite working code without a clear migration reason
- do not move many unrelated files to make the tree look cleaner
- do not introduce generic frameworks to bridge a short transition
- do not leave duplicate owners for session, thread, or draft state
- do not let temporary compatibility code become the new architecture
