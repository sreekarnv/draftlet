---
name: FastAPI Daemon
description: Rules for Draftlet local runtime and FastAPI backend design, including route boundaries, services, persistence, prompt orchestration, and streaming.
---

# FastAPI Daemon

Use this skill for:
- local runtime/backend work
- FastAPI route and service design
- persistence design
- prompt-building and generation orchestration
- streaming implementation decisions

## Goal

Keep the local runtime simple, explicit, and reliable.

Draftlet's daemon should be understandable without heavy abstractions.

The daemon owns model access, prompt building, streaming generation, and durable session/thread data. It should not know about page DOM details.

## Preferred architecture style

Prefer:
- thin routes
- explicit services
- focused storage modules
- typed schemas
- clear streaming boundaries
- local-first design

Avoid:
- repository patterns
- dependency injection frameworks
- generic pipeline abstractions
- giant god modules
- business logic spread across routes and helpers without structure

## Suggested structure

A reasonable shape is:

- routes/
- services/
- schemas/
- storage/
- core/
- streaming/

The exact folders may vary, but responsibilities should remain clear.

## Route rules

Routes should:
- validate input
- call a service
- return a typed response
- remain small and readable
- map service errors into consistent API errors

Routes should not:
- perform deep orchestration
- construct prompts inline
- mix transport and persistence logic
- contain long branching workflows

## Service rules

Services should:
- orchestrate a single clear unit of behavior
- call storage and runtime/model helpers explicitly
- stay understandable
- be easy to test

Prefer service functions over large service classes unless stateful behavior truly requires it.

Use explicit functions and modules before introducing abstractions. Add indirection only when it removes real duplication or clarifies ownership.

## Persistence rules

Persist only what has product value.

Likely persistence areas:
- workspace sessions
- conversation threads
- turns
- draft variants
- preferences
- runtime-related status if needed

Keep schemas and storage readable.
Make migrations explicit.
Avoid hidden magic.

Persistence should support thread-aware drafting and follow-up refinement, not just one-shot generation logs.

## Prompt-building rules

Prompt construction should be:
- centralized
- versionable
- testable
- driven by product rules

Prompt logic should reflect:
- tone
- target length
- coverage mode
- source complexity
- thread context
- follow-up instructions

Do not scatter prompt shaping across many files.

Prompt tests should cover source complexity, multi-point coverage, refinement instructions, and preservation of user intent.

## Streaming rules

Streaming should be:
- isolated
- typed where practical
- resilient to partial failures
- easy to test
- easy to map into UI state transitions

Support explicit states such as:
- queued
- started
- partial
- completed
- failed
- cancelled

Streaming events should map cleanly to side panel states without requiring UI-specific branching in daemon code.

## Generation quality rules

The daemon should help enforce product behavior such as:
- long source -> adequately detailed reply
- multi-point source -> coverage-aware response
- thread-aware refinement rather than repeated stateless output
- variant generation with intentional differences

## Config rules

Runtime config should be:
- explicit
- validated
- easy to inspect
- separated from request handling

Avoid hidden environment assumptions.

## Testing guidance

Prioritize tests for:
- prompt builder
- schema validation
- service behavior
- storage operations
- streaming parsing/transport
- failure states
- route/service error mapping

## Do not

- do not mix prompt building, transport, persistence, and formatting in one file
- do not let routes grow into orchestration layers
- do not introduce generic frameworks just to feel architected
- do not hard-code browser-specific UI assumptions into daemon logic
- do not replace explicit service functions with repository or pipeline patterns without a concrete need
