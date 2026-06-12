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

    const updated = store.setActiveThread(session.sessionId, 'thread-1', 'turn-1');

    expect(updated?.activeThreadId).toBe('thread-1');
    expect(updated?.activeTurnId).toBe('turn-1');
    expect(store.getBySessionId(session.sessionId)?.activeThreadId).toBe('thread-1');
  });

  it('stores bounded insertion target metadata with page context', () => {
    const store = createTestStore();
    const composeTarget = {
      targetId: 'input-a',
      kind: 'textarea' as const,
      pageUrl: 'https://example.com/thread',
      origin: 'https://example.com',
      selector: 'textarea[name="reply"]',
      fingerprint: 'textarea|reply',
      lastSeenAt: '2026-01-01T00:00:00.000Z',
    };

    const session = store.upsertFromPageContext({
      context: {
        ...context('First'),
        composeTarget,
      },
      tabId: 10,
    });

    expect(session.insertionTarget).toEqual(composeTarget);
    expect(session.insertionTargetStatus).toBe('live');

    const stale = store.updateInsertionTarget(session.sessionId, composeTarget, 'stale');

    expect(stale?.insertionTargetStatus).toBe('stale');
    expect(stale?.latestContext.composeTarget).toEqual(composeTarget);
  });

  it('does not touch a session when insertion target status is unchanged', () => {
    const store = createTestStore();
    const composeTarget = {
      targetId: 'input-a',
      kind: 'textarea' as const,
      pageUrl: 'https://example.com/thread',
      origin: 'https://example.com',
      selector: 'textarea[name="reply"]',
      fingerprint: 'textarea|reply',
      lastSeenAt: '2026-01-01T00:00:00.000Z',
    };
    const session = store.upsertFromPageContext({
      context: {
        ...context('First'),
        composeTarget,
      },
      tabId: 10,
    });

    const unchanged = store.updateInsertionTarget(session.sessionId, {
      ...composeTarget,
      lastSeenAt: '2026-01-01T00:00:30.000Z',
    }, 'live');

    expect(unchanged).toBeNull();
    expect(store.getBySessionId(session.sessionId)?.updatedAt).toBe(session.updatedAt);
  });

  it('stores tab ambiguity candidates and clears them after target status changes', () => {
    const store = createTestStore();
    const session = store.upsertFromPageContext({ context: context('First'), tabId: 10 });
    const candidates = [
      {
        tabId: 10,
        windowId: 1,
        title: 'Thread',
        url: 'https://example.com/thread',
        origin: 'https://example.com',
        active: true,
        currentWindow: true,
        matchReason: 'session_url',
      },
    ] as const;
    const ambiguous = store.updatePlausibleTabs(session.sessionId, [...candidates]);

    expect(ambiguous?.insertionTargetStatus).toBe('tab_disambiguation_required');
    expect(ambiguous?.plausibleTabs).toHaveLength(1);
    expect(store.updatePlausibleTabs(session.sessionId, [...candidates])).toBeNull();

    const rebound = store.updateInsertionTarget(session.sessionId, undefined, 'needs_recapture');

    expect(rebound?.insertionTargetStatus).toBe('needs_recapture');
    expect(rebound?.plausibleTabs).toBeUndefined();

    const focusRequired = store.updateInsertionTarget(session.sessionId, undefined, 'needs_focus');

    expect(focusRequired?.insertionTargetStatus).toBe('needs_focus');
    expect(focusRequired?.plausibleTabs).toBeUndefined();
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
    expect(store.getBySessionId(first.sessionId)?.activeRunId).toBe('generation-a');
    expect(store.getBySessionId(second.sessionId)?.activeGeneration).toMatchObject({
      generationId: 'generation-b',
      status: 'starting',
    });
    expect(store.findByGenerationId('generation-b')?.sessionId).toBe(second.sessionId);

    store.clearActiveGeneration(first.sessionId, 'generation-a');

    expect(store.getBySessionId(first.sessionId)?.activeGeneration).toBeUndefined();
    expect(store.getBySessionId(first.sessionId)?.activeRunId).toBeUndefined();
    expect(store.getBySessionId(second.sessionId)?.activeGeneration?.generationId).toBe('generation-b');
  });
  it('hydrates a persisted session for workspace restore', () => {
    const store = createTestStore();

    const restored = store.hydrateSession({
      sessionId: 'session-history',
      tabId: -1,
      pageUrl: 'https://example.com/history',
      pageTitle: 'History',
      latestContext: context('Historical message', 'https://example.com/history'),
      status: 'active',
      activeThreadId: 'thread-history',
      activeTurnId: 'turn-history',
      activeRunId: 'run-history',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
    });

    expect(restored.activeThreadId).toBe('thread-history');
    expect(restored.activeTurnId).toBe('turn-history');
    expect(restored.activeRunId).toBe('run-history');
    expect(store.getBySessionId('session-history')?.latestContext.selectedText).toBe('Historical message');
    expect(store.getByTabId(-1)?.sessionId).toBe('session-history');
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
