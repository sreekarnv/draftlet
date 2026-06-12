# Recapture Validation Checklist

Use this checklist after loading the extension in a browser build. It covers the restored-session recapture paths that cannot be fully proven by unit tests because they depend on live tabs, page focus, and editable DOM state.

## Setup

- Start the Draftlet runtime.
- Load the unpacked extension build.
- Open the side panel from a page with a normal compose field.
- Generate or restore a thread with a persisted `ComposeTargetRef`.
- Keep copy/manual fallback available for every case below.

## Restored Target Paths

### Selected Tab Needs Focus

1. Restore a session whose original tab is plausible.
2. Choose the correct tab from the side panel tab selection flow.
3. Leave all compose fields unfocused in that tab.
4. Retry recapture from the side panel.

Expected result:
- side panel shows that the selected tab is reachable but needs a focused compose field
- selected tab metadata remains visible
- retry action remains available
- copy/manual fallback remains available
- background diagnostics include a focus-required recapture outcome

### Focus Then Retry Succeeds

1. Continue from the focus-required state.
2. Open the selected tab using the side panel action.
3. Focus the compose field in that tab.
4. Retry recapture from the side panel.

Expected result:
- recapture succeeds
- target status returns to live
- target metadata updates as before
- insertion can proceed through the normal explicit insert action
- copy/manual fallback remains available if insertion later fails

### Selected Tab Target Is Stale

1. Restore a session whose persisted compose target exists in metadata.
2. Choose a plausible tab.
3. Let the page replace or remove the original compose field before retrying recapture.
4. Retry recapture.

Expected result:
- side panel shows a stale-target or recapture-failed state with a clear reason
- retry remains explicit
- user can focus a new compose field and retry
- copy/manual fallback remains available

### Selected Tab Becomes Unavailable

1. Restore a session and reach the plausible tab choice.
2. Close the selected tab before retrying recapture.
3. Retry recapture.

Expected result:
- background returns a typed unavailable-tab outcome
- side panel shows that the selected tab can no longer be used
- user can reselect a plausible tab when available
- copy/manual fallback remains available

## Diagnostics Relay

1. Produce at least one failed or focus-required recapture attempt.
2. Open the extension popup.
3. Use `Send to desktop`.
4. Open desktop diagnostics and load the browser report.
5. Copy the loaded report.

Expected result:
- desktop shows report metadata, recent entries, and freshness window
- copied report uses `draftlet.recapture-diagnostics`
- report does not include selected text, generated draft text, full page content, DOM selectors, cookies, tokens, local runtime secrets, or raw exception objects
- expired reports ask for a fresh popup send

## Pass Criteria

- The user never has to guess whether to focus a compose field or retry.
- The selected tab is visible when it matters.
- Every failed recapture path has an explicit reason and a retry or fallback path.
- Successful recapture preserves existing insertion behavior.
- Content script remains limited to focused target discovery, target restoration, and insertion.

## QA Record

Fill this in when running the checklist against a loaded browser extension.

Environment:
- Date:
- Extension build:
- Browser/version:
- Runtime build:
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
