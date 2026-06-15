#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Locate the Electron chrome-sandbox helper across the typical install layouts.
# We never auto-chmod and never auto-disable the sandbox; both decisions stay
# with the developer. We only print a stderr notice on Linux when the helper
# exists but is not mode 4755.
SANDBOX_HELPER="$(find "$ROOT_DIR/apps/desktop/node_modules/electron/dist" -maxdepth 2 -name chrome-sandbox -type f 2>/dev/null | head -n 1 || true)"

if [ "${OS:-$(uname -s)}" = "Linux" ] && [ -n "${SANDBOX_HELPER:-}" ]; then
  HELPER_MODE="$(stat -c '%a' "$SANDBOX_HELPER" 2>/dev/null || echo 0)"
  if [ "$HELPER_MODE" != "4755" ]; then
    printf '\n[draftlet:dev-desktop] Linux chrome-sandbox helper is mode %s, expected 4755.\n' "$HELPER_MODE" >&2
    printf '[draftlet:dev-desktop] Fix it with:\n' >&2
    printf '  sudo chown root:root %s\n' "$SANDBOX_HELPER" >&2
    printf '  sudo chmod 4755    %s\n' "$SANDBOX_HELPER" >&2
    printf '[draftlet:dev-desktop] Or, dev-only, run with: ELECTRON_DISABLE_SANDBOX=1 pnpm dev:desktop\n' >&2
    printf '[draftlet:dev-desktop] See docs/troubleshooting.md#electron-dev-fails-on-linux-sandbox-setup for details.\n\n' >&2
  fi
fi

# Assumes Node dependencies have been installed from the repo root with:
#   pnpm install
pnpm --dir "$ROOT_DIR/apps/desktop" start
