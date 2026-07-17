# Draftlet API

Local FastAPI runtime for Draftlet.

## Run

```bash
uv sync
uv run dev
```

The runtime listens on:

```text
http://127.0.0.1:8000
```

## Check

```bash
uv run ruff check .
```

## Build

```bash
uv build
```

## Package Runtime

```bash
uv run package-runtime
```

The packaged runtime is written to `dist-runtime/` for the Electron build.

## Telegram Environment

Telegram uses MTProto user-client auth. Configure these before connecting
Telegram in the desktop app:

```env
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=0123456789abcdef0123456789abcdef
```

Optional:

```env
TELEGRAM_ENABLED=true
```

## Local Data

By default the runtime stores SQLite data in the API working directory.
