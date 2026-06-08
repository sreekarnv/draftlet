# Draftlet Architecture

Draftlet is a local-first browser drafting assistant. It helps a user capture context from a webpage, generate high-quality reply drafts through a local runtime, refine those drafts over multiple turns, and insert only user-approved text back into the page.

Draftlet v2 should feel browser-native, but the webpage must not own the Draftlet workflow. The page is an integration point. Draftlet-owned surfaces own the assistant experience.

## Current State

The current implementation is a proof of concept and migration base. It proves the main product loop:
- webpage selection and editable target detection
- a browser extension UI
- a desktop companion
- a local FastAPI server
- Ollama-backed streaming generation
- local persistence for history and preferences
- best-effort insertion into common editors

The POC is useful, but it should not freeze the architecture. Some responsibilities are still too close to webpage integration and one-shot generation. v2 should move toward thread-aware drafting, clearer ownership, and typed contracts across boundaries.

## Target v2 Model

Draftlet v2 is composed of six major surfaces:

### Content Script
The content script is the page integration layer. It detects editable surfaces, captures selection or nearby context, shows tiny inline affordances, performs best-effort insertion, and relays structured messages to extension-owned surfaces.

It must stay lightweight. It must not own prompt logic, model orchestration, persistence, thread state, or the local runtime connection.

### Extension Service Worker / Background
The service worker coordinates extension-level behavior. It routes commands, manages browser lifecycle concerns, coordinates tab/session identity, checks capabilities, and brokers communication between extension surfaces and the local runtime.

It should keep browser-level state minimal and explicit. It should not become a second backend or a catch-all business logic module.

### Side Panel
The side panel is the primary Draftlet workflow surface. It owns the extension drafting workspace: session context, thread view, streaming drafts, follow-up instructions, variant comparison, review, and insertion controls.

The side panel is where the user should spend time drafting. It is not a thin wrapper around a webpage overlay.

### Popup
The popup is for quick actions, status, shortcuts, runtime availability, and entry into the side panel. It should be compact and predictable.

The popup must not become the full drafting app.

### Desktop App
The desktop app owns machine-local and operational concerns: onboarding, runtime setup, local dependency checks, tray behavior, logs, diagnostics, settings, and advanced controls.

It may act as the operator-facing shell for the runtime. It should not own page-specific workflows or compete with the side panel as the main drafting surface.

### Local Runtime / Daemon
The local runtime owns model access, prompt building, streaming generation, persistence, thread/session storage, preferences, and future retrieval or enrichment features.

FastAPI routes should remain thin. Runtime behavior should be organized through explicit services, schemas, storage modules, and streaming helpers rather than generic frameworks.

## Core Rule

The webpage must not own the Draftlet workflow.

The webpage may help Draftlet understand context and insert approved output. It must not own session lifecycle, thread state, prompt construction, generation, persistence, or direct local runtime access.

## Domain Concepts

Draftlet should migrate toward these domain entities.

### WorkspaceSession
A Draftlet workspace tied to a browsing context. It may reference the tab, window, page URL, page title, current compose target metadata, creation time, update time, and status.

The extension coordinates session identity. The runtime should persist sessions when they need to survive reloads, reconnects, or app restarts.

### ConversationThread
A drafting thread within a workspace. It contains the source snapshot, contextual metadata, draft history, and thread status.

This is the unit for thread-aware drafting and follow-up instructions.

### Turn
One user/model exchange within a thread. A turn should preserve source input, user instruction, model output, edited output, timestamps, and generation metadata.

Turns are how Draftlet avoids treating every refinement as a stateless one-shot request.

### DraftVariant
A generated draft associated with a turn. A variant should capture content, tone, length, coverage mode, rank/order, and accepted or rejected status.

Variants support comparison, iteration, and controlled insertion.

## Migration Direction

Migrate toward v2 in scoped steps:
- keep page capture and insertion reliable while reducing content script ownership
- move runtime connection ownership into Draftlet-controlled extension, desktop, or daemon layers
- introduce shared contracts before expanding cross-surface workflows
- model sessions, threads, turns, and variants explicitly
- make the side panel the primary workflow before removing old flows
- move prompt building and durable drafting state into the runtime
- delete obsolete POC paths only after replacement behavior is validated

## Design Principles

- Keep architecture explicit and understandable.
- Prefer small services and thin orchestration layers.
- Use typed contracts for cross-boundary communication.
- Keep extension, desktop, and runtime responsibilities separate.
- Avoid duplicate long-lived state across surfaces.
- Keep business logic out of content scripts.
- Preserve user control over insertion and final edits.
- Make failure, retry, and streaming states visible.
- Update architecture docs when ownership changes.

## Non-Goals

- Do not turn the content script into the main app.
- Do not build large floating overlays as the primary UX.
- Do not let the webpage directly own local runtime access.
- Do not make the popup the full drafting workspace.
- Do not introduce repository patterns, dependency injection frameworks, or generic pipeline abstractions for simple local flows.
- Do not perform broad rewrites without a realistic migration path.
