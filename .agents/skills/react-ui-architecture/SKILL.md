---
name: React UI Architecture
description: Rules for structuring Draftlet React code across extension and desktop surfaces, including component boundaries, shared UI usage, forms, state management, routing, and file size discipline.
---

# React UI Architecture

Use this skill for:
- React component structure
- splitting large UI files
- route/page organization
- hooks, stores, and UI state ownership
- form architecture
- shared UI decisions across extension and desktop surfaces

## Goals

Draftlet React code should be easy to navigate, test, and migrate toward shared UI without turning the repo into a framework project.

Prefer:
- small files with one clear responsibility
- explicit feature boundaries
- shared primitives only when reuse is real
- thin route/page files
- durable state owned by runtime/domain snapshots, not duplicated in UI stores

Avoid:
- giant files that mix rendering, workflow orchestration, helpers, data mapping, and styles
- route files becoming feature modules
- broad UI refactors bundled with unrelated product changes
- generic frontend architecture layers that do not solve a Draftlet problem

## File Splitting

Split React files when they contain multiple independent regions, workflows, or state machines.

Good extraction targets:
- presentational components for stable visual pieces
- feature components for one workflow section
- hooks for reusable UI behavior or browser/IPC wiring
- small pure helpers for display mapping and sorting
- Zustand stores for shared UI/app state

Do not split only to create indirection. Keep tiny one-use components inline when the parent remains readable.

## Boundaries

Route/page files:
- choose the route/view
- fetch or receive top-level data
- compose feature components
- handle page-level loading/error states

Feature components:
- own a bounded workflow or panel region
- receive typed data and callbacks
- avoid direct runtime/browser transport unless that surface already owns it

Shared components:
- live in `packages/shared` when used, or clearly intended to be used, by more than one surface
- should be UI primitives, tokens, layout helpers, or generic Draftlet controls
- must not depend on extension-only browser APIs or desktop-only Electron APIs

## State

Use local `useState` for state that is truly local to one component.

Use Zustand, or a similarly small repo-standard state manager if one is later adopted, for cross-component UI/app state such as:
- selected workspace view across sibling components
- panel-level UI preferences
- desktop diagnostics filters shared by multiple widgets
- multi-step setup/onboarding UI state

Do not copy durable domain data into UI stores as a second source of truth. Prefer runtime-backed `WorkspaceSession`, `ConversationThread`, `Turn`, `DraftVariant`, and `GenerationRun` snapshots plus local UI state around them.

## Forms

Use `react-hook-form` for non-trivial forms:
- settings forms
- onboarding/setup forms
- runtime/model configuration
- diagnostics filters with validation/defaults
- multi-field submit flows

Simple single-field controls can stay as local controlled inputs. Keep validation rules, defaults, and submit behavior explicit.

## Routing

Use React Router where a surface has real page/view boundaries:
- desktop runtime/setup/diagnostics/help pages
- extension surfaces if they grow beyond simple local tabs
- views that should have clear navigation, route-level loading, or route-level errors

Do not add React Router for small segmented controls or tabs that are only local UI state.

## Shared UI

Future shared UI belongs in `packages/shared`.

Before adding a new surface-local primitive, check whether it should be shared between extension and desktop. If it is shared, keep it platform-neutral and pass platform-specific behavior through props/callbacks.

Do not import extension browser APIs, Electron IPC, runtime clients, or content-script logic into shared UI primitives.

## Migration Discipline

When touching an existing large React file:
- avoid adding another unrelated workflow to it
- extract only the pieces needed for the current change
- keep behavior stable while improving structure
- add focused tests when splitting changes workflow behavior

Do not start the broad shared UI/refactor work unless the task explicitly asks for it.
