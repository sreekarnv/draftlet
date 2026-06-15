#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIDS=()

# Starts the local development stack: FastAPI server, WXT extension, and Electron companion.
# This intentionally keeps process management simple for local development.
#
# Each child is wrapped in `setsid` so the whole process group is killed
# on Ctrl-C / SIGTERM. pnpm and electron-forge spawn grandchildren
# (Electron, the uvicorn worker, the WXT dev server) that would
# otherwise outlive the cleanup if we only killed the direct PIDs.
start_process() {
  local name="$1"
  shift

  echo "Starting $name..."
  if command -v setsid >/dev/null 2>&1; then
    setsid "$@" &
  else
    "$@" &
  fi
  PIDS+=("$!")
}

cleanup() {
  if (( ${#PIDS[@]} > 0 )); then
    for pid in "${PIDS[@]}"; do
      # Send SIGTERM to the process group (negative pid) so all
      # descendants shut down with the parent.
      kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    done
    # Give the children a moment to exit cleanly, then SIGKILL stragglers.
    sleep 1
    for pid in "${PIDS[@]}"; do
      kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
    done
  fi
}

trap cleanup INT TERM EXIT

start_process "Draftlet server" "$ROOT_DIR/scripts/dev-server.sh"
start_process "Draftlet extension" "$ROOT_DIR/scripts/dev-extension.sh"
start_process "Draftlet desktop" "$ROOT_DIR/scripts/dev-desktop.sh"

wait
