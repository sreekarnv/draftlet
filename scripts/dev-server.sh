#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Assumes uv is installed and server dependencies have been synced with:
#   cd apps/server && uv sync --group dev
cd "$ROOT_DIR/apps/server"
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 47632
