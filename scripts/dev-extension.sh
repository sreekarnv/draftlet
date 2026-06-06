#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Assumes Node dependencies have been installed from the repo root with:
#   pnpm install
pnpm --dir "$ROOT_DIR/apps/extension" dev
