import { describe, expect, it } from 'vitest';

import { createConversationThreadStore } from '../../core/conversation-thread';
import type { DraftletSidePanelContext } from '../../core/messages';

describe('conversation thread store', () => {
  it('creates a session-backed thread from page context', () => {
    const store = createTestStore();

    const snapshot = store.ensureThreadForSession({
      sessionId: 'session-1',
      context: context('Please reply to this.'),
    });

    expect(snapshot.thread).toMatchObject({
      threadId: 'thread-1',
      sessionId: 'session-1',
      status: 'active',
      source: {
        selectedText: 'Please reply to this.',
        sourceUrl: 'https://example.com/thread',
      },
    });
    expect(snapshot.turns).toEqual([]);
    expect(snapshot.variants).toEqual([]);
  });

  it('appends turns and draft variants to the active thread', () => {
    const store = createTestStore();
    const thread = store.ensureThreadForSession({
      sessionId: 'session-1',
      context: context('Original message'),
    });

    const turnResult = store.createTurn({
      threadId: thread.thread.threadId,
      context: context('Original message'),
      tone: 'friendly',
    });

    expect(turnResult?.turn).toMatchObject({
      turnId: 'turn-2',
      threadId: 'thread-1',
      tone: 'friendly',
      generationStatus: 'queued',
    });

    const firstVariant = store.addVariant({
      turnId: turnResult!.turn.turnId,
      tone: 'friendly',
      content: 'First draft',
      persistedReplyId: 101,
    });
    const secondVariant = store.addVariant({
      turnId: turnResult!.turn.turnId,
      tone: 'friendly',
      content: 'Second draft',
    });

    expect(firstVariant?.variant).toMatchObject({
      variantId: 'variant-3',
      rank: 0,
      persistedReplyId: 101,
    });
    expect(secondVariant?.variant).toMatchObject({
      variantId: 'variant-4',
      rank: 1,
      content: 'Second draft',
    });
    expect(secondVariant?.snapshot.variants.map((variant) => variant.content)).toEqual([
      'First draft',
      'Second draft',
    ]);
  });

  it('updates turn status without losing variants', () => {
    const store = createTestStore();
    const thread = store.ensureThreadForSession({
      sessionId: 'session-1',
      context: context('Original message'),
    });
    const turnResult = store.createTurn({
      threadId: thread.thread.threadId,
      context: context('Original message'),
      tone: 'concise',
    })!;
    store.addVariant({
      turnId: turnResult.turn.turnId,
      tone: 'concise',
      content: 'Draft',
    });

    const completed = store.updateTurnStatus(turnResult.turn.turnId, 'completed');

    expect(completed?.turns[0].generationStatus).toBe('completed');
    expect(completed?.variants).toHaveLength(1);
  });

  it('reuses the active thread for the same session', () => {
    const store = createTestStore();
    const initial = store.ensureThreadForSession({
      sessionId: 'session-1',
      context: context('First'),
    });

    const restored = store.ensureThreadForSession({
      sessionId: 'session-1',
      activeThreadId: initial.thread.threadId,
      context: context('Updated'),
    });

    expect(restored.thread.threadId).toBe(initial.thread.threadId);
    expect(restored.thread.source.selectedText).toBe('Updated');
  });
});

function createTestStore() {
  let id = 0;
  let tick = 0;

  return createConversationThreadStore({
    createId: (prefix) => `${prefix}-${++id}`,
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
  });
}

function context(selectedText: string): DraftletSidePanelContext {
  return {
    selectedText,
    sourceUrl: 'https://example.com/thread',
    sourceDomain: 'example.com',
    pageTitle: 'Example',
  };
}
