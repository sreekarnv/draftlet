import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GET_RECAPTURE_DIAGNOSTICS,
  GET_RUNTIME_STATUS,
  PUBLISH_RECAPTURE_DIAGNOSTICS_REPORT,
  type RecaptureDiagnosticsResult,
  type RuntimeStatusResult,
} from '../../core/messages';

interface PopupGlobals {
  browser: { runtime: { sendMessage: ReturnType<typeof vi.fn> } };
  navigator: { clipboard: { writeText: ReturnType<typeof vi.fn> } };
}

function createPopupHarness(options: { runtimeStatus?: RuntimeStatusResult['status'] } = {}): { root: HTMLElement; sent: { type: string }[]; writeText: ReturnType<typeof vi.fn> } {
  const sent: { type: string }[] = [];
  const writeText = vi.fn(async () => undefined);
  const runtimeStatus = options.runtimeStatus ?? 'connected';

  const root = document.createElement('div');
  root.id = 'root';
  document.body.replaceChildren(root);

  const sendMessage = vi.fn(async (message: { type: string }) => {
    sent.push(message);

    if (message.type === GET_RUNTIME_STATUS) {
      return { status: runtimeStatus } satisfies RuntimeStatusResult;
    }

    if (message.type === GET_RECAPTURE_DIAGNOSTICS) {
      return {
        entries: [
          {
            id: 1,
            event: 'content_recapture_failed',
            level: 'error',
            sessionId: 'session-1',
            message: 'Compose field not found.',
            at: '2026-01-01T00:00:00.000Z',
          },
        ],
        publish: {
          queued: false,
          retryPending: false,
          inFlight: false,
          retryCount: 0,
          maxRetryAttempts: 3,
        },
      } satisfies RecaptureDiagnosticsResult;
    }

    if (message.type === PUBLISH_RECAPTURE_DIAGNOSTICS_REPORT) {
      return { ok: true };
    }

    return undefined;
  });

  const globals = {
    browser: { runtime: { sendMessage } },
    navigator: { clipboard: { writeText } },
  } satisfies PopupGlobals;

  vi.stubGlobal('browser', globals.browser);
  Object.defineProperty(window, 'navigator', { value: globals.navigator, configurable: true });

  return { root, sent, writeText };
}

function setDebugFlag(value: '1' | undefined): void {
  if (value === undefined) {
    delete process.env.DRAFTLET_DEBUG_INSERTION;
  } else {
    process.env.DRAFTLET_DEBUG_INSERTION = value;
  }
  vi.stubEnv('DRAFTLET_DEBUG_INSERTION', value);
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '';
});

afterEach(() => {
  setDebugFlag(undefined);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('popup (default flow, DRAFTLET_DEBUG_INSERTION unset)', () => {
  it('does not render the Recapture diagnostics section, Send to desktop, or Loading... state', async () => {
    setDebugFlag(undefined);
    createPopupHarness();
    await import('../../ui/popup');

    await new Promise((resolve) => setTimeout(resolve, 0));

    const text = document.body.textContent ?? '';
    expect(text).not.toContain('Recapture diagnostics');
    expect(text).not.toContain('Send to desktop');
    expect(text).not.toContain('Loading...');
    expect(document.getElementById('publish-diagnostics')).toBeNull();
    expect(document.getElementById('copy-diagnostics')).toBeNull();
    expect(document.getElementById('diagnostics-list')).toBeNull();
    expect(document.getElementById('publish-state')).toBeNull();
    expect(document.getElementById('copy-status')).toBeNull();
  });

  it('still sends GET_RUNTIME_STATUS to render the runtime pill', async () => {
    setDebugFlag(undefined);
    const { sent } = createPopupHarness();
    await import('../../ui/popup');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sent.some((message) => message.type === GET_RUNTIME_STATUS)).toBe(true);
    expect(document.getElementById('runtime-status')?.textContent).toBe('Ready');
  });

  it('does not call GET_RECAPTURE_DIAGNOSTICS when the flag is off', async () => {
    setDebugFlag(undefined);
    const { sent } = createPopupHarness();
    await import('../../ui/popup');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sent.some((message) => message.type === GET_RECAPTURE_DIAGNOSTICS)).toBe(false);
  });

  it('shows a local-server hint when disconnected', async () => {
    setDebugFlag(undefined);
    createPopupHarness({ runtimeStatus: 'disconnected' });
    await import('../../ui/popup');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.getElementById('runtime-status')?.textContent).toBe('Server offline');
    expect(document.getElementById('runtime-hint')?.textContent).toBe('Start Draftlet from the desktop app, then refresh.');
  });
});

describe('popup (DRAFTLET_DEBUG_INSERTION=1)', () => {
  it('renders the full diagnostics surface when the flag is set', async () => {
    setDebugFlag('1');
    createPopupHarness();
    await import('../../ui/popup');

    await new Promise((resolve) => setTimeout(resolve, 10));

    const text = document.body.textContent ?? '';
    expect(text).toContain('Recapture diagnostics');
    expect(text).toContain('Send to desktop');
    expect(document.getElementById('publish-diagnostics')).not.toBeNull();
    expect(document.getElementById('copy-diagnostics')).not.toBeNull();
    expect(document.getElementById('diagnostics-list')).not.toBeNull();
  });

  it('does not leave a stuck Loading... state in the diagnostics list once data resolves', async () => {
    setDebugFlag('1');
    createPopupHarness();
    await import('../../ui/popup');

    await new Promise((resolve) => setTimeout(resolve, 10));

    const list = document.getElementById('diagnostics-list');
    expect(list?.textContent ?? '').not.toContain('Loading...');
    expect(list?.textContent ?? '').toContain('Compose field not found.');
  });

  it('fetches diagnostics and renders entries', async () => {
    setDebugFlag('1');
    const { sent } = createPopupHarness();
    await import('../../ui/popup');

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(sent.some((message) => message.type === GET_RECAPTURE_DIAGNOSTICS)).toBe(true);
    const list = document.getElementById('diagnostics-list');
    expect(list?.textContent ?? '').toContain('Compose field not found.');
  });
});

describe('readDebugFlag helper', () => {
  it('falls back to process.env when import.meta.env is missing the variable', async () => {
    setDebugFlag(undefined);
    vi.stubEnv('DRAFTLET_DEBUG_INSERTION', undefined);
    process.env.DRAFTLET_DEBUG_INSERTION = '1';

    const { readDebugFlag } = await import('../../ui/popup-env');

    expect(readDebugFlag()).toBe(true);
  });

  it('returns false when neither source sets the flag', async () => {
    setDebugFlag(undefined);
    const { readDebugFlag } = await import('../../ui/popup-env');

    expect(readDebugFlag()).toBe(false);
  });
});
