# Recapture target recovery (dev-only)

> **Dev-only manual QA.** This document covers the recapture background contract in the Draftlet extension. Recapture is not part of the user-facing flow in the side panel. It exists as a background contract for the extension's recapture diagnostics log, the tab-activation message contract, and the integration tests that exercise the recapture path.
>
> Re-enable the popup's recapture diagnostics surface for manual debugging by setting `DRAFTLET_DEBUG_INSERTION=1` in the shell before starting the extension dev process.
>
> The unit tests under `apps/extension/tests/core/background/insertion-coordinator.test.ts` and `apps/extension/tests/core/content-script-insert-recovery.test.ts` cover the same behavior. Use this checklist only when a manual browser run is required.

This checklist covers the recapture and insertion-target recovery paths that cannot be fully proven by unit tests because they depend on live tabs, page focus, and editable DOM state.

## Setup

- Start the Draftlet runtime.
- Load the unpacked extension build with `DRAFTLET_DEBUG_INSERTION=1` exported in the dev shell, so the popup's recapture diagnostics section is visible.
- Open the side panel from a page with a normal compose field.
- Generate or restore a thread with a persisted `ComposeTargetRef`.
- Keep Copy and manual paste available for every case below.

## Restored target paths

### Selected tab needs focus

1. Restore a session whose original tab is plausible.
2. Choose the correct tab from the side panel tab selection flow.
3. Leave all compose fields unfocused in that tab.
4. Use `Insert` in the side panel; the Insert/Use chain arms a focusin listener and activates the tab.

Expected result:
- side panel shows that the selected tab is reachable but needs a focused compose field
- selected tab metadata remains visible
- the `Click the compose field to insert.` pending state appears immediately via the `INSERTION_IN_PROGRESS` extension message
- copy/manual fallback remains available
- background diagnostics include a focus-required recapture outcome (visible in the dev-only popup section)

### Focus then retry succeeds

1. Continue from the focus-required state.
2. Focus the compose field in the activated tab.
3. The arm listener resolves with the new target snapshot.
4. The side panel completes Insert and lands the draft in the compose field.

Expected result:
- insertion succeeds
- the side panel renders the inserted variant
- copy/manual fallback remains available if insertion later fails

### Selected tab target is stale

1. Restore a session whose persisted compose target exists in metadata.
2. Choose a plausible tab.
3. Let the page replace or remove the original compose field before triggering Insert.
4. Use Insert.

Expected result:
- side panel shows a stale-target state with a clear reason
- Insert still tries the new capture; on a fresh focus, the arm listener succeeds
- copy/manual fallback remains available

### Selected tab becomes unavailable

1. Restore a session and reach the plausible tab choice.
2. Close the selected tab before triggering Insert.
3. Use Insert.

Expected result:
- background returns a typed unavailable-tab outcome
- side panel shows that the selected tab can no longer be used
- copy/manual fallback remains available

## Diagnostics relay

1. Produce at least one failed or focus-required recapture attempt (see the cases above).
2. Open the desktop companion's diagnostics page and refresh.
3. Load or copy the browser report.
4. Optional: open the extension popup and use `Send to desktop` to manually republish the same bounded report (popup diagnostics section is only visible with `DRAFTLET_DEBUG_INSERTION=1`).

Expected result:
- desktop shows report metadata, summary target state, recent entries, and freshness window
- copied report uses `draftlet.recapture-diagnostics`
- report does not include selected text, generated draft text, full page content, DOM selectors, cookies, tokens, local runtime secrets, or raw exception objects
- missing reports clearly say the extension has not published one yet; expired reports ask for a fresh recapture or popup send

## Pass criteria

- The user never has to guess whether to focus a compose field or retry.
- The selected tab is visible when it matters.
- Every failed recapture path has an explicit reason and a retry or fallback path.
- Successful recapture preserves existing insertion behavior.
- Content script remains limited to focused target discovery, target restoration, and insertion.

## QA record

Fill this in when running the checklist against a loaded browser extension.

Environment:
- Date:
- Extension build:
- Browser/version:
- Runtime build:
- `DRAFTLET_DEBUG_INSERTION` set: yes / no
- Test pages:

Results:

| Case | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Selected tab needs focus | Not run |  |  |
| Focus then retry succeeds | Not run |  |  |
| Selected tab target is stale | Not run |  |  |
| Selected tab becomes unavailable | Not run |  |  |
| Diagnostics relay and copy | Not run |  |  |

Use `Pass`, `Fail`, or `Blocked` for status. Evidence can be a screenshot path, copied diagnostics report filename, or brief reproduction note.

Ship decision:
- Approved by:
- Blocking failures:
- Follow-up issues:
