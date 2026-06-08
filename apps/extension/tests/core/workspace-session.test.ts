import { describe, expect, it } from 'vitest';

import { createWorkspaceSessionStore } from '../../core/workspace-session';
import type { DraftletSidePanelContext } from '../../core/messages';

describe('workspace session store', () => {
  it('keeps page context scoped by tab', () => {
    const store = createTestStore();

    const first = store.upsertFromPageContext({
      context: context('First selection', 'https://example.com/a'),
      tabId: 10,
      windowId: 1,
    });
    const second = store.upsertFromPageContext({
      context: context('Second selection', 'https://example.com/b'),
      tabId: 11,
      windowId: 1,
    });

    expect(first.sessionId).toBe('session-1');
    expect(second.sessionId).toBe('session-2');
    expect(store.getByTabId(10)?.latestContext.selectedText).toBe('First selection');
    expect(store.getByTabId(11)?.latestContext.selectedText).toBe('Second selection');
  });

  it('updates an existing tab session when the page URL is unchanged', () => {
    const store = createTestStore();

    const initial = store.upsertFromPageContext({
      context: context('Initial', 'https://example.com/thread'),
      tabId: 10,
    });
    const updated = store.upsertFromPageContext({
      context: context('Updated', 'https://example.com/thread'),
      tabId: 10,
    });

    expect(updated.sessionId).toBe(initial.sessionId);
    expect(updated.latestContext.selectedText).toBe('Updated');
    expect(updated.createdAt).toBe(initial.createdAt);
    expect(updated.updatedAt).not.toBe(initial.updatedAt);
  });

  it('creates a new session for the same tab after navigation', () => {
    const store = createTestStore();

    const initial = store.upsertFromPageContext({
      context: context('Initial', 'https://example.com/thread'),
      tabId: 10,
    });
    const navigated = store.upsertFromPageContext({
      context: context('Next page', 'https://example.com/next'),
      tabId: 10,
    });

    expect(navigated.sessionId).toBe('session-2');
    expect(navigated.sessionId).not.toBe(initial.sessionId);
    expect(store.getByTabId(10)?.sessionId).toBe(navigated.sessionId);
  });

  it('stores active thread metadata for a session', () => {
    const store = createTestStore();
    const session = store.upsertFromPageContext({ context: context('First'), tabId: 10 });

    const updated = store.setActiveThread(session.sessionId, 'thread-1');

    expect(updated?.activeThreadId).toBe('thread-1');
    expect(store.getBySessionId(session.sessionId)?.activeThreadId).toBe('thread-1');
  });

  it('tracks active generation metadata per session', () => {
    const store = createTestStore();
    const first = store.upsertFromPageContext({ context: context('First'), tabId: 10 });
    const second = store.upsertFromPageContext({ context: context('Second'), tabId: 11 });

    store.setActiveGeneration(first.sessionId, {
      generationId: 'generation-a',
      status: 'starting',
      startedAt: '2026-01-01T00:00:03.000Z',
    });
    store.setActiveGeneration(second.sessionId, {
      generationId: 'generation-b',
      status: 'starting',
      startedAt: '2026-01-01T00:00:04.000Z',
    });
    store.updateActiveGenerationStatus(first.sessionId, 'generation-a', 'streaming');

    expect(store.getBySessionId(first.sessionId)?.activeGeneration).toMatchObject({
      generationId: 'generation-a',
      status: 'streaming',
    });
    expect(store.getBySessionId(second.sessionId)?.activeGeneration).toMatchObject({
      generationId: 'generation-b',
      status: 'starting',
    });
    expect(store.findByGenerationId('generation-b')?.sessionId).toBe(second.sessionId);

    store.clearActiveGeneration(first.sessionId, 'generation-a');

    expect(store.getBySessionId(first.sessionId)?.activeGeneration).toBeUndefined();
    expect(store.getBySessionId(second.sessionId)?.activeGeneration?.generationId).toBe('generation-b');
  });
});

function createTestStore() {
  let id = 0;
  let tick = 0;

  return createWorkspaceSessionStore({
    createId: () => `session-${++id}`,
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
  });
}

function context(
  selectedText: string,
  sourceUrl = 'https://example.com/thread',
): DraftletSidePanelContext {
  return {
    selectedText,
    sourceUrl,
    sourceDomain: 'example.com',
    pageTitle: 'Example',
  };
}
