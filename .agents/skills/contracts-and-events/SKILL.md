---
name: Contracts and Events
description: Rules for Draftlet cross-boundary communication, including typed message contracts, event naming, shared schemas, and error shape consistency.
---

# Contracts and Events

Use this skill for:
- shared types/schemas
- event design
- extension messaging
- runtime request/response design
- cross-boundary communication rules

## Purpose

Draftlet has multiple surfaces and boundaries.

This skill ensures communication remains:
- typed
- explicit
- traceable
- stable
- versionable when needed

## Contracts first

Any communication between these layers should use explicit contracts:
- content script <-> service worker
- side panel <-> service worker
- popup <-> service worker
- extension <-> runtime
- desktop <-> runtime
- shared persistence schemas where appropriate

Do not rely on ad hoc message shapes.

Define shared schemas in the repo's shared contract location when a payload crosses a boundary. Do not duplicate the same shape in each surface.

## Contract rules

Contracts should be:
- narrow in purpose
- named clearly
- serializable
- easy to validate
- documented

Payloads should prefer:
- stable primitive fields
- explicit optional fields
- small nested structures only when useful

Avoid:
- giant unstructured blobs
- arbitrary any payloads
- duplicating types in multiple packages
- payloads that mix UI state, transport state, and domain state

## Event design rules

Use event names that describe what happened, not vague action names. Prefer a consistent namespace and tense.

Good categories:
- session created
- session restored
- thread created
- thread updated
- generation started
- generation delta received
- generation completed
- generation failed
- insertion requested
- insertion succeeded
- insertion failed
- runtime connected
- runtime disconnected

Prefer a clear naming strategy and stick to it.

Commands should read like requests. Events should read like facts that occurred.

## Request/response guidance

For request/response contracts:
- define the request shape
- define the success shape
- define the failure shape
- include identifiers where needed
- keep correlation easy

For streaming:
- define start, partial, complete, and error events clearly
- include enough metadata for UI recovery and debugging
- include correlation identifiers for long-running generation
- make cancellation and retry behavior explicit

## Versioning guidance

Not every contract needs heavy versioning on day one, but design so change is manageable.

Prefer:
- centralized schema definitions
- reuse across surfaces
- explicit deprecations when fields change

## Recommended shared entities

Shared contracts may include concepts like:
- SessionRef
- ThreadRef
- TurnRef
- DraftVariantRef
- ComposeTargetRef
- SourceSnapshot
- GenerationOptions
- RuntimeStatus
- InsertionResult

These are examples, not mandatory exact names.

Align names with Draftlet domain concepts: WorkspaceSession, ConversationThread, Turn, and DraftVariant.

## Error shape guidance

Errors crossing boundaries should be structured.

Prefer fields like:
- code
- message
- retryable
- details optional and limited
- correlation_id if relevant

Avoid passing raw internal exceptions directly to UI.

Retryable errors should be machine-readable so surfaces can show the right retry path.

## Debuggability rules

Cross-boundary systems are hard to debug without discipline.

Prefer:
- typed event logs in development
- correlation IDs for streamed operations
- consistent identifiers across request lifecycle
- explicit state transitions

## Documentation rules

When introducing or changing important contracts:
- update the relevant docs
- note old vs new behavior when migrating
- keep examples current

## Do not

- do not duplicate the same contract in multiple places
- do not send loosely structured messages between surfaces
- do not hide state transitions inside ambiguous status strings
- do not let every surface invent its own error format
- do not use raw string literals as the only source of truth for cross-boundary message types
