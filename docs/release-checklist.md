# Public Release Checklist

This checklist covers the manual and automated checks used before making the Draftlet repository public. It is meant to be run from a freshly cloned checkout, on a workstation that already has Node.js, pnpm, Python 3.12+, uv, and (optionally) Ollama installed.

For the recapture-specific manual checks, see [`recapture-validation.md`](recapture-validation.md). For setup, troubleshooting, and architecture references, see [`setup.md`](setup.md), [`troubleshooting.md`](troubleshooting.md), and the documents under `docs/architecture/`.

## 1. Fresh-clone command validation

Run from the repo root, unless noted.

```bash
pnpm install
pnpm typecheck
pnpm build

pnpm --dir apps/extension test
pnpm --dir apps/desktop test

cd apps/server
uv sync --group dev
uv run alembic upgrade head
uv run pytest
cd ../..
```

Expected results:

- `pnpm typecheck` runs the shared package typecheck, the extension typecheck, and the desktop typecheck in sequence and exits 0.
- `pnpm build` produces a packaged Python server bundle, packages the Electron desktop app, and builds the Chrome MV3 extension.
- `pnpm make:desktop` runs `DRAFTLET_MAKE_DEB=1 DRAFTLET_MAKE_APPIMAGE=1 pnpm --dir apps/desktop make` and produces the Linux `.deb` and ZIP installers under `apps/desktop/out/make/`. On Debian/Ubuntu hosts, this needs `fakeroot` and `dpkg` to be installed.
- Extension test command runs ~230 tests across ~24 files.
- Desktop test command runs 35 tests across 4 files.
- Server `uv run pytest` runs 70 tests across the server package, including the CORS settings tests under `tests/test_cors.py` and the diagnostics API tests under `tests/test_diagnostics_api.py`.
- `uv run alembic upgrade head` reports the current head revision (verify against the top of `apps/server/alembic/versions/`).

If a command is environment-specific (for example, the Linux desktop maker needs `fakeroot` and `dpkg`), note that in [`troubleshooting.md`](troubleshooting.md) rather than pretending it works everywhere.

## 2. Runtime / extension checks

Required:

- Start the local runtime.
- Load the unpacked extension from `apps/extension/.output/chrome-mv3`.
- Open the side panel from a page with a normal compose field.
- Generate or restore a thread with a persisted `ComposeTargetRef`.

Then verify:

- Selecting text on a simple webpage shows the Draftlet trigger and opens the side panel.
- The initial draft streams into the side panel and lands in the current variant.
- A new follow-up instruction (for example, "make this warmer") starts a fresh turn and replaces the current draft.
- The cancel action stops an in-flight generation and leaves the run recoverable through the runtime maintenance diagnostics.
- The accept-current-variant action marks the active variant as accepted and the rest of the thread reflects the new state.
- Copy works for the current variant on every surface.
- Insertion into a plain `<textarea>` works end-to-end.
- Insertion into a basic `contenteditable` works end-to-end when the page does not override the input pipeline.
- A recapture prompt appears when the saved `ComposeTargetRef` is no longer reachable, and the side panel's `Insert` / `Use` action rebinds the target to the newly focused field. The recapture background contract is exercised in the dev-only manual QA checklist under [docs/dev/recapture-target-recovery.md](dev/recapture-target-recovery.md).
- A restored session whose original tab is still around offers a tab disambiguation step before insertion.
- The history list loads existing threads and restores the previous one with the same turn and variant layout.
- The runtime restart recovery / interrupted run guidance matches the behavior described in [`troubleshooting.md`](troubleshooting.md).

## 3. Desktop checks

Required:

- Launch the desktop companion via `pnpm dev:desktop` or the packaged build under `apps/desktop/out/`.
- Have a working Ollama install with at least one model pulled.

Then verify:

- Launching the desktop shows the main window and the tray icon.
- The Ollama status card reports the running Ollama instance and lists the installed models.
- Model detection surfaces the configured model and lets the user switch to a different installed model.
- Start server requests the local server and reports a `ready` state once `/health` returns success.
- Stop server stops only a server that identifies itself as Draftlet, never an unrelated process on port 47632.
- Restart server stops and then starts the server cleanly.
- Closing the main window keeps the desktop process running in the tray.
- Quitting the desktop from the tray menu actually exits the desktop process.
- The diagnostics page loads the latest browser recapture diagnostics report when the extension has published one.
- The diagnostics page loads the runtime generation-run maintenance endpoint and shows the most recent startup reconciliation, stale reconciliation, and replay-prune outcomes.

## 4. Server checks

- `GET /health` returns `{"status":"healthy","service":"draftlet-server","app":"draftlet","version":"0.1.1"}` and HTTP 200.
- `uv run alembic upgrade head` reports the database is at the head revision.
- The default development database file (`apps/server/draftlet.db`) is created on first run, and a clean `rm apps/server/draftlet.db && uv run alembic upgrade head` cycle recreates it without errors.
- After a runtime restart, the startup maintenance hook reconciles any interrupted runs and reports a `runtime_restarted` error message in the runtime maintenance endpoint.
- The CORS middleware allows:
  - `http://127.0.0.1:47632` and `http://localhost:47632` (extension loopback)
  - `http://127.0.0.1:5173` and `http://localhost:5173` (Vite dev server, if used)
  - Any `chrome-extension://<id>` origin via the default regex
  - and rejects any other origin with no `Access-Control-Allow-Origin` response header.

  These defaults can be overridden through the `DRAFTLET_CORS_ALLOW_ORIGINS` and `DRAFTLET_CORS_ALLOW_ORIGIN_REGEX` environment variables (set the regex to `disabled` to drop chrome-extension origins entirely).

## 5. Documentation checks

- The [`README.md`](../README.md) quick start still matches the documented setup commands and the documented port (`47632`).
- [`docs/setup.md`](setup.md) commands line up with the current `package.json` scripts and the Python tooling flow.
- [`docs/troubleshooting.md`](troubleshooting.md) covers the failures observed during this checklist.
- No public-facing doc mentions "v2" in headings, names, or filenames. Internal `AGENTS.md` and `.agents/skills/` rules are not public-facing.
- No public-facing doc claims the extension is in the Chrome Web Store, claims Ollama is bundled, or makes marketing-level privacy claims beyond what the local-first design actually delivers.
- The developer-only docs under [`docs/dev/`](dev/) are not referenced from the public docs index.
- The troubleshooting entry for stale or interrupted generation recovery matches the behavior in `apps/server/app/services/domain_service.py`.
- The setup entry for CORS environment variables matches the current `apps/server/app/core/config.py` defaults.

## 6. Repository hygiene checks

- `.gitignore` covers `node_modules/`, `.venv/`, `__pycache__/`, `*.db`, `*.db-shm`, `*.db-wal`, `.env`, `.env.*`, `.DS_Store`, `.pytest_cache/`, `.wxt/`, `.output/`, `dist/`, `apps/desktop/.vite/`, `apps/desktop/out/`, `apps/server/build/`, and `apps/server/dist/`.
- The production extension manifest under `apps/extension/.output/chrome-mv3/manifest.json` is regenerated by `pnpm --dir apps/extension build` and only contains the `sidePanel` permission plus a `<all_urls>` content script entry.
- The dev manifest under `apps/extension/.output/chrome-mv3-dev/manifest.json` is regenerated by `pnpm dev:extension` and only includes the additional dev-only permissions and host permissions that WXT requires for hot reload.
- No private keys, tokens, signed extension IDs, or local database files are committed.

## 7. Sign-off

Record the outcome of each section above before tagging a public release.

- Release version:
- Release date:
- Reviewed by:
- Blocking issues:
- Follow-up issues:
