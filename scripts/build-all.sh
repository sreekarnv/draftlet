#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Release-oriented local build:
# 1. Build the bundled Python server.
# 2. Package the Electron desktop app with that server copied into resources.
# 3. Build the browser extension artifact.
#
# Assumes dependencies are already installed:
#   pnpm install
#   cd apps/server && uv sync --group dev
"$ROOT_DIR/scripts/build-server.sh"
pnpm --dir "$ROOT_DIR/apps/desktop" package
pnpm --dir "$ROOT_DIR/apps/extension" build
