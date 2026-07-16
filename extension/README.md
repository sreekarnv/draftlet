# Draftlet Gmail Extension

WXT + React Chrome extension for capturing selected Gmail text into the local Draftlet runtime.

## Development

```bash
pnpm install
pnpm dev
```

For a loadable Chrome build:

```bash
pnpm build
```

Then open `chrome://extensions`, enable Developer mode, choose Load unpacked, and select:

```text
extension/.output/chrome-mv3
```

## Local Smoke

1. Start the Draftlet runtime at `http://127.0.0.1:8000`.
2. Build and load the extension from `.output/chrome-mv3`.
3. Open Gmail and reload the Gmail tab after installing the extension.
4. Open a Gmail thread.
5. Select the exact text to capture.
6. Click the Draftlet extension action and capture selected text.
7. Verify the thread appears in desktop `/email`.

## Scope

- Chrome MV3 only for now.
- Selection-first Gmail DOM capture.
- Posts to `POST /api/v1/connectors/gmail/captures`.
- Does not use Gmail OAuth or Gmail API sync.
- Does not send email.

The selectors are intentionally conservative for an MVP and may need hardening as Gmail DOM cases are discovered.
