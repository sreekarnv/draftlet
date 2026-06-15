#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/apps/server"

# Builds a PyInstaller onedir server bundle at apps/server/dist/draftlet-server.
# Assumes uv has synced server dev dependencies, including PyInstaller:
#   cd apps/server && uv sync --group dev

if ! command -v uv >/dev/null 2>&1; then
  echo "scripts/build-server.sh: 'uv' is not on PATH." >&2
  echo "Install it from https://docs.astral.sh/uv/ and re-run." >&2
  exit 127
fi

if ! uv run python -c "import PyInstaller" >/dev/null 2>&1; then
  echo "scripts/build-server.sh: PyInstaller is not installed in the current uv env." >&2
  echo "Run 'cd apps/server && uv sync --group dev' first, then re-run." >&2
  exit 127
fi

uv run pyinstaller --clean --noconfirm draftlet-server.spec
