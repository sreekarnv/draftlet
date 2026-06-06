#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIDS=()

# Starts the local development stack: FastAPI server, WXT extension, and Electron companion.
# This intentionally keeps process management simple for local development.
start_process() {
  local name="$1"
  shift

  echo "Starting $name..."
  "$@" &
  PIDS+=("$!")
}

cleanup() {
  if (( ${#PIDS[@]} > 0 )); then
    kill "${PIDS[@]}" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

start_process "Draftlet server" "$ROOT_DIR/scripts/dev-server.sh"
start_process "Draftlet extension" "$ROOT_DIR/scripts/dev-extension.sh"
start_process "Draftlet desktop" "$ROOT_DIR/scripts/dev-desktop.sh"

wait
