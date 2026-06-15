#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[1/4] Typechecking shared package"
pnpm --dir "$ROOT_DIR/packages/shared" --silent build

echo "[2/4] Building bundled Python server"
"$ROOT_DIR/scripts/build-server.sh"

if [[ ! -x "$ROOT_DIR/apps/server/dist/draftlet-server/draftlet-server" ]]; then
  echo "scripts/build-all.sh: expected server bundle at $ROOT_DIR/apps/server/dist/draftlet-server/draftlet-server" >&2
  echo "The desktop app will still be packaged, but without a bundled local server." >&2
fi

echo "[3/4] Packaging Electron desktop app"
pnpm --dir "$ROOT_DIR/apps/desktop" package

echo "[4/4] Building browser extension"
pnpm --dir "$ROOT_DIR/apps/extension" build

echo "[5/5] Generating desktop installers"
DRAFTLET_MAKE_DEB=1 DRAFTLET_MAKE_APPIMAGE=1 pnpm --dir apps/desktop make