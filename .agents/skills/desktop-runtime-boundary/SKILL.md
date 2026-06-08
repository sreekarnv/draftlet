---
name: Desktop Runtime Boundary
description: Rules for separating Draftlet desktop app, local runtime, and browser-extension responsibilities, including tray behavior, setup, and diagnostics.
---

# Desktop Runtime Boundary

Use this skill for:
- Electron/Desktop decisions
- runtime ownership decisions
- tray behavior
- onboarding/setup flows
- diagnostics and settings placement
- deciding what belongs in desktop vs extension vs daemon

## Purpose

This skill keeps the desktop app focused on machine-local and operational concerns, while keeping browser drafting workflows in the extension.

## Desktop app responsibilities

The desktop app should own:
- first-run onboarding
- runtime setup
- checking local dependencies
- starting/stopping runtime processes
- tray integration
- logs and diagnostics
- advanced settings
- update-oriented operational UX
- future background capabilities that are not page-specific

The desktop app may also act as the operator-facing shell for the daemon/runtime.

## Desktop app should not own

- page DOM interactions
- content-script workflows
- per-page selection capture
- inline drafting affordances
- browser-side insertion logic

Those belong in the extension.

## Runtime / daemon responsibilities

The runtime should own:
- model access
- prompt orchestration
- generation requests
- streaming responses
- persistence
- session/thread/turn storage
- user preferences that are runtime-scoped
- future retrieval or memory-style features if added

The runtime should expose stable, typed interfaces.

The runtime should not assume browser DOM details or desktop UI behavior.

## Extension responsibilities relative to desktop

The extension should own:
- browser-side UX
- page integration
- side panel and popup
- tab-aware session coordination
- user actions that originate from pages

The extension may talk to the desktop/runtime, but should not absorb runtime responsibilities.

## Tray behavior rules

If a tray exists:
- closing the desktop window should usually minimize to tray if enabled
- quitting should be explicit
- tray state should reflect runtime state
- tray actions should include:
  - open app
  - show status
  - start/stop runtime if relevant
  - quit

Avoid confusing hidden-state behavior.

## Connectivity model guidance

Prefer a model where:
- browser surfaces talk through extension-owned orchestration
- local runtime access is owned by Draftlet-controlled layers
- user-facing workflow does not depend on the webpage owning local connection logic

The exact mechanism can evolve, but ownership should remain clear.

The webpage must not directly own Draftlet's local runtime connection.

## Settings placement guidance

### Put in extension settings if:
- it affects browser-side drafting UX
- it is lightweight and frequently adjusted
- it is specific to page workflows

### Put in desktop settings if:
- it affects runtime setup or lifecycle
- it is machine-local
- it affects logs, diagnostics, startup, tray, models, or advanced operational behavior

### Put in runtime persistence if:
- it affects generation/session behavior shared across surfaces
- it must be available regardless of current UI surface

## Failure handling expectations

Design desktop/runtime integration for:
- runtime not installed
- runtime not running
- runtime crashed
- stale status
- partial setup
- invalid config
- startup timeout

These must surface clearly to users and developers.

## Do not

- do not move browser UX into desktop just because the extension is growing
- do not let desktop become a second main app competing with the side panel
- do not put page-specific workflow state into the desktop UI unless there is a strong reason
- do not hide runtime lifecycle behavior behind unclear desktop controls
