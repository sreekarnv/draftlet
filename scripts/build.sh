#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[1/6] Typechecking shared package"
pnpm --dir "$ROOT_DIR/packages/shared" --silent build

echo "[2/6] Generating app icons"
pnpm --dir "$ROOT_DIR" icons

echo "[3/6] Building bundled Python server"
"$ROOT_DIR/scripts/build-server.sh"

echo "[4/6] Packaging Electron desktop app"
pnpm --dir "$ROOT_DIR/apps/desktop" package

echo "[5/6] Building browser extension"
pnpm --dir "$ROOT_DIR/apps/extension" build

echo "[6/6] Generating desktop installers"
DRAFTLET_MAKE_DEB=1 DRAFTLET_MAKE_APPIMAGE=1 pnpm --dir "$ROOT_DIR/apps/desktop" make
