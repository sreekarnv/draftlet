# Draftlet Desktop

Electron + React 19 + Vite+ desktop app for Draftlet.

## Development

Desktop development requires the API runtime to be running in another terminal.

Terminal 1:

```bash
cd ../api
uv run dev
```

Terminal 2:

```bash
vp install
vp dev
```

The desktop app expects the runtime at:

```text
http://127.0.0.1:8000
```

## Check

```bash
vp check
```

## Build

```bash
vp run build
```

The Linux AppImage build output is written under `release/`.
