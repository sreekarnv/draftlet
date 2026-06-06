#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/apps/server"

# Builds a PyInstaller onedir server bundle at apps/server/dist/draftlet-server.
# Assumes uv has synced server dev dependencies, including PyInstaller.
uv run pyinstaller --clean --noconfirm draftlet-server.spec
