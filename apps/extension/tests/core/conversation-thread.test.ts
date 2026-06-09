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
    });
    const secondVariant = store.addVariant({
      turnId: turnResult!.turn.turnId,
      tone: 'friendly',
      content: 'Second draft',
    });

    expect(firstVariant?.variant).toMatchObject({
      variantId: 'variant-3',
      rank: 0,
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
    expect(firstVariant?.variant.isCurrent).toBe(false);
  });

  it('marks one selected and accepted variant per thread', () => {
    const store = createTestStore();
    const thread = store.ensureThreadForSession({
      sessionId: 'session-1',
      context: context('Original message'),
    });
    const turnResult = store.createTurn({
      threadId: thread.thread.threadId,
      context: context('Original message'),
      tone: 'friendly',
    })!;
    const first = store.addVariant({
      turnId: turnResult.turn.turnId,
      tone: 'friendly',
      content: 'First draft',
      variantId: 'runtime-variant-1',
    })!;
    const second = store.addVariant({
      turnId: turnResult.turn.turnId,
      tone: 'friendly',
      content: 'Second draft',
      variantId: 'runtime-variant-2',
    })!;

    expect(first.variant.variantId).toBe('runtime-variant-1');
    store.updateVariantState(first.variant.variantId, { isCurrent: true });
    const accepted = store.updateVariantState(second.variant.variantId, { status: 'accepted' });

    expect(accepted?.variants).toEqual(expect.arrayContaining([
      expect.objectContaining({ variantId: 'runtime-variant-1', isCurrent: false, status: 'generated' }),
      expect.objectContaining({ variantId: 'runtime-variant-2', isCurrent: true, status: 'accepted' }),
    ]));
  });

  it('updates turn lifecycle without losing variants', () => {
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

    const streaming = store.updateTurnStatus(turnResult.turn.turnId, 'streaming');
    const failed = store.updateTurnStatus(turnResult.turn.turnId, 'failed', {
      code: 'runtime_unavailable',
      message: 'Draftlet server is not reachable.',
    });

    expect(streaming?.turns[0].generationStartedAt).toBeTruthy();
    expect(failed?.turns[0]).toMatchObject({
      generationStatus: 'failed',
      generationErrorCode: 'runtime_unavailable',
      generationErrorMessage: 'Draftlet server is not reachable.',
    });
    expect(failed?.turns[0].generationFailedAt).toBeTruthy();
    expect(failed?.variants).toHaveLength(1);
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

  it('hydrates a persisted thread snapshot for later refinement turns', () => {
    const store = createTestStore();
    const initial = store.ensureThreadForSession({
      sessionId: 'session-1',
      context: context('Original message'),
    });
    const turnResult = store.createTurn({
      threadId: initial.thread.threadId,
      context: context('Original message'),
      tone: 'friendly',
    })!;
    store.addVariant({
      turnId: turnResult.turn.turnId,
      tone: 'friendly',
      content: 'Prior draft',
    });

    const restored = createTestStore();
    const hydrated = restored.hydrateSnapshot(store.getSnapshot(initial.thread.threadId)!);
    const refinement = restored.createTurn({
      threadId: hydrated.thread.threadId,
      context: context('Original message'),
      tone: 'friendly',
      instruction: 'Make it warmer',
    });

    expect(refinement?.turn).toMatchObject({
      threadId: initial.thread.threadId,
      instruction: 'Make it warmer',
      generationStatus: 'queued',
    });
    expect(refinement?.snapshot.variants.map((variant) => variant.content)).toEqual(['Prior draft']);
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
