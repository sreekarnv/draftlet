# Draftlet Architecture

Draftlet is a local-first browser drafting assistant. It helps a user capture context from a webpage, generate high-quality reply drafts through a local runtime, refine those drafts over multiple turns in a thread, and insert only user-approved text back into the page.

Draftlet behaves like a browser-native assistant backed by a local runtime. The webpage is an integration point; Draftlet-owned surfaces own the assistant experience.

## Core rule

The webpage must not own the Draftlet workflow.

The page may help Draftlet understand context and insert approved output. It must not own session lifecycle, thread state, prompt construction, generation, persistence, or direct local runtime access.

## Surfaces

Draftlet is composed of six major surfaces. Each one has a narrow responsibility and explicit ownership boundaries.

### Content script

The content script is the page integration layer. It detects editable surfaces, captures selection or nearby context, shows tiny inline affordances, performs best-effort insertion, and relays structured messages to extension-owned surfaces.

It must stay lightweight. It must not own prompt logic, model orchestration, persistence, thread state, or the local runtime connection.

### Extension service worker / background

The service worker coordinates extension-level behavior. It routes commands, manages browser lifecycle concerns, coordinates tab/session identity, checks capabilities, and brokers communication between extension surfaces and the local runtime.

It keeps browser-level state minimal and explicit. It is not a second backend or a catch-all business logic module.

### Side panel

The side panel is the primary Draftlet workflow surface. It owns the extension drafting workspace: session context, thread view, streaming drafts, follow-up instructions, variant comparison, review, and insertion controls.

The side panel is where the user spends time drafting. It is not a thin wrapper around a webpage overlay.

### Popup

The popup is for quick actions, runtime status, refresh, and entry into the side panel. It stays compact and predictable.

The popup must not become the full drafting app. The popup exposes recapture diagnostics, but only when `DRAFTLET_DEBUG_INSERTION=1` is set; the default user flow does not show diagnostics.

### Desktop app

The desktop app owns machine-local and operational concerns: first-run onboarding, runtime setup, local dependency checks, tray behavior, logs, diagnostics, settings, and advanced controls.

It may act as the operator-facing shell for the runtime. It must not own page-specific workflows or compete with the side panel as the main drafting surface.

### Local runtime / daemon

The local runtime owns model access, prompt building, streaming generation, persistence for sessions, threads, turns, draft variants, generation runs, preferences, and bounded diagnostics relay.

FastAPI routes stay thin. Runtime behavior is organized through explicit services, schemas, storage modules, and streaming helpers rather than generic frameworks.

## Domain concepts

Draftlet's runtime and extension both speak the same domain model:

- **WorkspaceSession** — a Draftlet workspace tied to a browsing context. References the tab, window, page URL, page title, current compose target metadata, active thread/turn/run routing ids, creation and update time, and status. Persisted by the runtime so it can survive reloads, reconnects, and app restarts.
- **ConversationThread** — a drafting thread within a workspace. Contains the source snapshot, contextual metadata, draft history, and thread status. The unit for thread-aware drafting and follow-up instructions.
- **Turn** — one user/model exchange within a thread. Preserves source input, user instruction, model output, edited output, timestamps, and generation metadata. Turns are how Draftlet avoids treating every refinement as a stateless one-shot request.
- **DraftVariant** — a generated draft associated with a turn. Captures content, tone, length, coverage mode, rank/order, and accepted or rejected status. Supports comparison, iteration, and controlled insertion.
- **GenerationRun** — a runtime-owned execution lease for a single live or recent generation attempt. Carries the `run_id`, status (`queued`, `started`, `streaming`, `completed`, `failed`, `cancelled`), lease owner, claim/heartbeat/release timestamps, bounded error metadata, replay cursor, and a feed attachment mode (`live_attached`, `replay_only`, or `stale`). Runtime enforces one fresh active lease per session and reconciles stale conflicts before allowing a new claim.

## State ownership

One clear owner per class of state:

- **Page DOM state** belongs to the content script and is ephemeral.
- **Extension coordination state** belongs in the service worker / background.
- **Drafting workflow UI state** belongs in the side panel.
- **Durable session, thread, turn, draft, prompt, generation, and preference state** belongs in the runtime.
- **Machine-local operational state** belongs in the desktop app.

Avoid mirrored mutable state across content script, popup, side panel, desktop, and runtime. Share identifiers, snapshots, and typed events instead.

## Persistence ownership

Runtime persistence owns:

- Workspace sessions that must survive reloads or reconnects
- Conversation threads
- Turns
- Draft variants
- Generation runs and run events
- Generation preferences
- Runtime-scoped settings
- Bounded browser recapture diagnostics reports (relayed from the extension)

Extension storage can hold lightweight browser coordination state. Desktop storage can hold machine-local setup and operational preferences. Content scripts do not persist domain state.

## Messaging ownership

Cross-surface communication uses typed contracts.

- Content script to service worker
- Side panel to service worker
- Popup to service worker
- Extension to runtime
- Desktop to runtime

Desktop-extension diagnostics messages are explicit and diagnostics-only. Browser recapture state remains extension-owned; the desktop may display the latest bounded, privacy-safe diagnostics report published by the extension through the runtime relay, but it must not activate tabs, retry recapture, or infer live DOM state.

The service worker coordinates extension message routing. The runtime exposes stable request/response and streaming interfaces. No surface invents ad hoc payloads for the same concept.

## Design principles

- Keep architecture explicit and understandable.
- Prefer small services and thin orchestration layers.
- Use typed contracts for cross-boundary communication.
- Keep extension, desktop, and runtime responsibilities separate.
- Avoid duplicate long-lived state across surfaces.
- Keep business logic out of content scripts.
- Preserve user control over insertion and final edits.
- Make failure, retry, and streaming states visible.
- Update architecture docs when ownership changes.

## Non-goals

- The content script is not the main app.
- Large floating overlays are not the primary UX.
- The webpage must not directly own local runtime access.
- The popup is not the full drafting workspace.
- No repository patterns, dependency injection frameworks, or generic pipeline abstractions for simple local flows.
- No broad rewrites without a realistic migration path.
