import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CONVERSATION_THREAD_UPDATED,
  DRAFT_TEXT_DELTA_RECEIVED,
  type ConversationThreadSnapshot,
  type DraftletSidePanelContext,
  type WorkspaceSession,
} from '../../core/messages';
import { createCommandSurface, type CommandSurfaceCallbacks } from '../../ui/command-surface/command-surface';
import { isCommandSurfaceShortcut } from '../../ui/command-surface/shortcut';

function context(): DraftletSidePanelContext {
  return {
    selectedText: 'Please reply to this thread.',
    sourceUrl: 'https://mail.example.com/thread/1',
    sourceDomain: 'mail.example.com',
    pageTitle: 'Thread',
  };
}

function session(): WorkspaceSession {
  return {
    sessionId: 'session-1',
    tabId: 10,
    pageUrl: 'https://mail.example.com/thread/1',
    latestContext: context(),
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function completedSnapshot(content = 'Final draft.'): ConversationThreadSnapshot {
  return {
    thread: {
      threadId: 'thread-1',
      sessionId: 'session-1',
      source: {
        selectedText: 'Please reply to this thread.',
        sourceUrl: 'https://mail.example.com/thread/1',
      },
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
      latestTurnId: 'turn-1',
    },
    turns: [
      {
        turnId: 'turn-1',
        threadId: 'thread-1',
        instruction: 'Generate reply drafts',
        source: {
          selectedText: 'Please reply to this thread.',
          sourceUrl: 'https://mail.example.com/thread/1',
        },
        tone: 'professional',
        generationStatus: 'completed',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:01.000Z',
      },
    ],
    variants: [
      {
        variantId: 'variant-1',
        turnId: 'turn-1',
        tone: 'professional',
        content,
        rank: 0,
        status: 'generated',
        isCurrent: true,
        createdAt: '2026-01-01T00:00:01.000Z',
        updatedAt: '2026-01-01T00:00:01.000Z',
      },
    ],
  };
}

function createCallbacks(overrides: Partial<CommandSurfaceCallbacks> = {}): CommandSurfaceCallbacks {
  return {
    createSession: vi.fn(async () => ({ created: true, session: session() })),
    startGeneration: vi.fn(async () => ({
      started: true,
      sessionId: 'session-1',
      generationId: 'generation-1',
      threadId: 'thread-1',
      turnId: 'turn-1',
    })),
    cancelGeneration: vi.fn(async () => undefined),
    insertDraft: vi.fn(async () => ({ status: 'inserted' as const, message: 'Inserted.', targetStatus: 'live' as const })),
    openWorkshop: vi.fn(async () => true),
    ...overrides,
  };
}

function getShadowRoot(): ShadowRoot {
  const host = document.querySelector('draftlet-command-surface');
  if (!host?.shadowRoot) {
    throw new Error('Command surface was not mounted.');
  }
  return host.shadowRoot;
}

async function click(label: string): Promise<void> {
  const button = Array.from(getShadowRoot().querySelectorAll('button')).find((candidate) => candidate.textContent === label);
  if (!button) {
    throw new Error(`Missing button: ${label}`);
  }
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await Promise.resolve();
  await Promise.resolve();
}

function editor(): HTMLTextAreaElement {
  const textarea = getShadowRoot().querySelector('textarea');
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error('Missing command draft editor.');
  }
  return textarea;
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.documentElement.querySelectorAll('draftlet-command-surface').forEach((element) => element.remove());
});

afterEach(() => {
  document.documentElement.querySelectorAll('draftlet-command-surface').forEach((element) => element.remove());
  vi.restoreAllMocks();
});

describe('isCommandSurfaceShortcut', () => {
  it('matches Ctrl+Shift+D only', () => {
    expect(isCommandSurfaceShortcut({ key: 'D', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, repeat: false })).toBe(true);
    expect(isCommandSurfaceShortcut({ key: 'd', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, repeat: false })).toBe(true);
    expect(isCommandSurfaceShortcut({ key: 'D', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, repeat: false })).toBe(false);
    expect(isCommandSurfaceShortcut({ key: 'D', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, repeat: true })).toBe(false);
  });
});

describe('Command Surface', () => {
  it('closes on Escape when idle', async () => {
    const surface = createCommandSurface(createCallbacks());
    surface.open(context());

    editor().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await Promise.resolve();

    expect(surface.isOpen()).toBe(false);
  });

  it('cancels active generation on Escape and preserves partial draft text', async () => {
    const callbacks = createCallbacks();
    const surface = createCommandSurface(callbacks);
    surface.open(context());

    await click('Generate');
    surface.handleMessage({
      type: DRAFT_TEXT_DELTA_RECEIVED,
      sessionId: 'session-1',
      generationId: 'generation-1',
      threadId: 'thread-1',
      turnId: 'turn-1',
      text: 'Hello there.',
      sequence: 1,
    });

    editor().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await Promise.resolve();

    expect(callbacks.cancelGeneration).toHaveBeenCalledWith('session-1', 'generation-1');
    expect(editor().value).toBe('Hello there.');
    expect(surface.isOpen()).toBe(true);
  });

  it('inserts the approved draft through the provided insertion callback and closes on inserted', async () => {
    const callbacks = createCallbacks();
    const surface = createCommandSurface(callbacks);
    surface.open(context());

    await click('Generate');
    surface.handleMessage({
      type: CONVERSATION_THREAD_UPDATED,
      sessionId: 'session-1',
      snapshot: completedSnapshot('Approved draft.'),
    });

    expect(editor().value).toBe('Approved draft.');
    await click('Insert');

    expect(callbacks.insertDraft).toHaveBeenCalledWith('session-1', 'Approved draft.');
    expect(surface.isOpen()).toBe(false);
  });
});
