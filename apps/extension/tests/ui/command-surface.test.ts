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
    getInsertionTargetStatus: vi.fn(async () => ({ status: 'live' as const, message: 'Compose target is available.' })),
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
  await flushAsync();
}

async function flushAsync(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}

function editor(): HTMLTextAreaElement {
  const textarea = getShadowRoot().querySelector('textarea');
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error('Missing command draft editor.');
  }
  return textarea;
}

function statusText(): string {
  return getShadowRoot().querySelector('.status')?.textContent ?? '';
}

function button(label: string): HTMLButtonElement {
  const found = Array.from(getShadowRoot().querySelectorAll('button')).find((candidate) => candidate.textContent === label);
  if (!(found instanceof HTMLButtonElement)) {
    throw new Error(`Missing button: ${label}`);
  }
  return found;
}

function selectByLabel(label: string): HTMLSelectElement {
  const found = Array.from(getShadowRoot().querySelectorAll('label')).find((candidate) => candidate.textContent?.includes(label));
  const select = found?.querySelector('select');
  if (!(select instanceof HTMLSelectElement)) {
    throw new Error(`Missing select: ${label}`);
  }
  return select;
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.documentElement.querySelectorAll('draftlet-command-surface').forEach((element) => element.remove());
});

afterEach(() => {
  document.documentElement.querySelectorAll('draftlet-command-surface').forEach((element) => element.remove());
  vi.unstubAllGlobals();
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

  it('restores prior page focus when the idle overlay closes', async () => {
    const textarea = document.createElement('textarea');
    document.body.append(textarea);
    textarea.focus();
    const surface = createCommandSurface(createCallbacks());

    surface.open(context());
    await Promise.resolve();
    expect(document.activeElement).not.toBe(textarea);

    editor().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await Promise.resolve();

    expect(surface.isOpen()).toBe(false);
    expect(document.activeElement).toBe(textarea);
  });

  it('handles Escape from the page while open without leaking it to page shortcuts', async () => {
    const pageKeydown = vi.fn();
    document.addEventListener('keydown', pageKeydown);
    const surface = createCommandSurface(createCallbacks());
    surface.open(context());

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();

    expect(surface.isOpen()).toBe(false);
    expect(pageKeydown).not.toHaveBeenCalled();
    document.removeEventListener('keydown', pageKeydown);
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

  it('passes selected surface and style when starting generation', async () => {
    const callbacks = createCallbacks();
    const surface = createCommandSurface(callbacks);
    surface.open({
      ...context(),
      detectedReplySurface: 'email',
      replySurface: 'email',
      replyStyle: 'friendly',
    });

    const surfaceSelect = selectByLabel('Surface');
    const styleSelect = selectByLabel('Style');
    surfaceSelect.value = 'text_message';
    surfaceSelect.dispatchEvent(new Event('change', { bubbles: true }));
    styleSelect.value = 'casual';
    styleSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await click('Generate');

    expect(callbacks.startGeneration).toHaveBeenCalledWith('session-1', {
      replySurface: 'text_message',
      replyStyle: 'casual',
    });
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

  it('focuses the completed draft with the caret at the end instead of selecting text', async () => {
    const surface = createCommandSurface(createCallbacks());
    surface.open(context());

    await click('Generate');
    surface.handleMessage({
      type: CONVERSATION_THREAD_UPDATED,
      sessionId: 'session-1',
      snapshot: completedSnapshot('Ready to edit.'),
    });
    await flushAsync();

    expect(getShadowRoot().activeElement).toBe(editor());
    expect(editor().selectionStart).toBe('Ready to edit.'.length);
    expect(editor().selectionEnd).toBe('Ready to edit.'.length);
  });

  it('preserves the draft and exposes copy fallback when insertion fails', async () => {
    const callbacks = createCallbacks({
      insertDraft: vi.fn(async () => ({
        status: 'failed' as const,
        message: 'Could not find a compose field.',
        targetStatus: 'unavailable' as const,
        errorCode: 'target_missing',
      })),
    });
    const surface = createCommandSurface(callbacks);
    surface.open(context());

    await click('Generate');
    surface.handleMessage({
      type: CONVERSATION_THREAD_UPDATED,
      sessionId: 'session-1',
      snapshot: completedSnapshot('Keep this draft.'),
    });
    await click('Insert');

    expect(surface.isOpen()).toBe(true);
    expect(editor().value).toBe('Keep this draft.');
    expect(statusText()).toContain('Could not find a compose field.');
    expect(button('Copy').disabled).toBe(false);
  });

  it('keeps the draft visible when insertion falls back to copied', async () => {
    const callbacks = createCallbacks({
      insertDraft: vi.fn(async () => ({
        status: 'copied' as const,
        message: 'Draftlet could not insert, so it copied the draft.',
        targetStatus: 'unavailable' as const,
      })),
    });
    const surface = createCommandSurface(callbacks);
    surface.open(context());

    await click('Generate');
    surface.handleMessage({
      type: CONVERSATION_THREAD_UPDATED,
      sessionId: 'session-1',
      snapshot: completedSnapshot('Copied draft.'),
    });
    await click('Insert');

    expect(surface.isOpen()).toBe(true);
    expect(editor().value).toBe('Copied draft.');
    expect(statusText()).toContain('copied');
  });

  it('copies the current draft from the explicit fallback button', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const surface = createCommandSurface(createCallbacks());
    surface.open(context());

    editor().value = 'Manual fallback draft.';
    editor().dispatchEvent(new Event('input', { bubbles: true }));
    await click('Copy');

    expect(writeText).toHaveBeenCalledWith('Manual fallback draft.');
    expect(surface.isOpen()).toBe(true);
    expect(statusText()).toContain('Copied draft.');
  });

  it('surfaces insertion target preflight status before trying recovery insertion', async () => {
    const callbacks = createCallbacks({
      getInsertionTargetStatus: vi.fn(async () => ({
        status: 'needs_recapture' as const,
        message: 'Focus a compose field before inserting.',
      })),
      insertDraft: vi.fn(async () => ({
        status: 'failed' as const,
        message: 'Could not insert the draft.',
        targetStatus: 'needs_recapture' as const,
      })),
    });
    const surface = createCommandSurface(callbacks);
    surface.open(context());

    await click('Generate');
    surface.handleMessage({
      type: CONVERSATION_THREAD_UPDATED,
      sessionId: 'session-1',
      snapshot: completedSnapshot('Needs target.'),
    });
    await click('Insert');

    expect(callbacks.getInsertionTargetStatus).toHaveBeenCalledWith('session-1');
    expect(callbacks.insertDraft).toHaveBeenCalledWith('session-1', 'Needs target.');
    expect(editor().value).toBe('Needs target.');
    expect(statusText()).toContain('Could not insert the draft.');
  });
});
