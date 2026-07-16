"""
Helper scripts for running alembic migrations.

Usage (via pyproject scripts):
    alembic-generate "migration message"
    alembic-upgrade [revision]
    alembic-downgrade [revision]

Usage (direct):
    python -m draftlet_api.scripts.alembic generate "migration message"
    python -m draftlet_api.scripts.alembic upgrade [revision]
    python -m draftlet_api.scripts.alembic downgrade [revision]
"""

import argparse
import subprocess
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[3]


def run_alembic(*args: str) -> int:
    cmd = [sys.executable, "-m", "alembic", *args]
    print(f"$ {' '.join(cmd)}  (cwd={API_ROOT})", flush=True)
    return subprocess.call(cmd, cwd=API_ROOT)


def generate() -> int:
    parser = argparse.ArgumentParser(
        prog="alembic-generate", description="Autogenerate a new revision"
    )
    parser.add_argument("message")
    args = parser.parse_args()
    return run_alembic("revision", "--autogenerate", "-m", args.message)


def upgrade() -> int:
    parser = argparse.ArgumentParser(
        prog="alembic-upgrade", description="Upgrade to a revision (default: head)"
    )
    parser.add_argument("revision", nargs="?", default="head")
    args = parser.parse_args()
    return run_alembic("upgrade", args.revision)


def downgrade() -> int:
    parser = argparse.ArgumentParser(
        prog="alembic-downgrade", description="Downgrade to a revision (default: -1)"
    )
    parser.add_argument("revision", nargs="?", default="-1")
    args = parser.parse_args()
    return run_alembic("downgrade", args.revision)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run common alembic commands.")
    sub = parser.add_subparsers(dest="command", required=True)

    gen = sub.add_parser("generate", help="autogenerate a new revision")
    gen.add_argument("message")

    up = sub.add_parser("upgrade", help="upgrade to a revision (default: head)")
    up.add_argument("revision", nargs="?", default="head")

    down = sub.add_parser("downgrade", help="downgrade to a revision (default: -1)")
    down.add_argument("revision", nargs="?", default="-1")

    args = parser.parse_args()
    if args.command == "generate":
        return run_alembic("revision", "--autogenerate", "-m", args.message)
    if args.command == "upgrade":
        return run_alembic("upgrade", args.revision)
    if args.command == "downgrade":
        return run_alembic("downgrade", args.revision)
    return 1


if __name__ == "__main__":
    sys.exit(main())
