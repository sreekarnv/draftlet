import shutil
import subprocess
import sys
from pathlib import Path


API_ROOT = Path(__file__).resolve().parents[3]
DIST_RUNTIME = API_ROOT / "dist-runtime"
BUILD_DIR = API_ROOT / "build" / "pyinstaller"
DIST_DIR = API_ROOT / "dist" / "pyinstaller"
RUNTIME_NAME = "draftlet-runtime"


def run(command: list[str]) -> None:
    print(f"$ {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=API_ROOT, check=True)


def main() -> None:
    shutil.rmtree(DIST_RUNTIME, ignore_errors=True)
    shutil.rmtree(BUILD_DIR, ignore_errors=True)
    shutil.rmtree(DIST_DIR, ignore_errors=True)
    DIST_RUNTIME.mkdir(parents=True)

    run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            "--clean",
            "--noconfirm",
            "--onefile",
            "--name",
            RUNTIME_NAME,
            "--paths",
            str(API_ROOT / "src"),
            "--collect-submodules",
            "draftlet_api",
            "--hidden-import",
            "aiosqlite",
            "--hidden-import",
            "greenlet",
            "--distpath",
            str(DIST_RUNTIME),
            "--workpath",
            str(BUILD_DIR),
            str(API_ROOT / "src" / "draftlet_api" / "runtime.py"),
        ]
    )

    shutil.copy2(API_ROOT / "alembic.ini", DIST_RUNTIME / "alembic.ini")
    shutil.copytree(
        API_ROOT / "src" / "alembic",
        DIST_RUNTIME / "alembic",
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )

    spec_file = API_ROOT / f"{RUNTIME_NAME}.spec"
    if spec_file.exists():
        spec_file.unlink()


if __name__ == "__main__":
    main()
