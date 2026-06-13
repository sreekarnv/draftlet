# Troubleshooting

## Ollama Is Missing

Install Ollama from `https://ollama.com/download`. On Linux, make sure `ollama` is available on `PATH`.

## Ollama Is Installed But Not Running

Start the Ollama app or run:

```bash
ollama serve
```

Then recheck status in the desktop app.

## Recommended Model Is Missing

Use the desktop app Pull Model action, or run:

```bash
ollama pull gemma3:4b
```

`gemma3:4b` is recommended for onboarding, but Draftlet can use another installed active model selected in the desktop app.

## Draftlet Server Is Not Ready

Check health:

```bash
curl http://127.0.0.1:47632/health
```

If another process is using port `47632`, stop that process or adjust local development setup. The desktop app only stops a process when `/health` identifies it as Draftlet.

## Runtime Maintenance Diagnostics

The desktop diagnostics page can load and copy a bounded runtime maintenance snapshot from:

```bash
curl http://127.0.0.1:47632/diagnostics/generation-runs/maintenance
```

These diagnostics are stored in the runtime database and retained for up to 30 days or 100 maintenance outcomes, whichever bound is reached first. The endpoint returns the latest startup maintenance, stale-run reconciliation, replay pruning, and the latest 20 retained outcomes.

## Extension Cannot Connect

Confirm the server is healthy, then reload the extension and the webpage. The extension expects the server at `http://127.0.0.1:47632`.

## Insert Does Not Work On A Site

Use Copy. Draftlet insertion is best-effort and varies by editor implementation. It currently targets native inputs, textareas, and basic contenteditable editors first.

## Electron Dev Fails On Linux Sandbox Setup

This can be a local Electron development environment issue. Check Electron's Linux sandbox guidance for your distro, or run the packaged build path if local dev sandbox permissions are the blocker.

## Clearing Local History

Development history is stored in the SQLite database at `apps/server/draftlet.db`. Packaged desktop builds store runtime data under the app user-data directory. Delete the relevant local database manually if you want to clear persisted history.
