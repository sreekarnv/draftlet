import { describe, expect, it } from 'vitest';

import { buildThreadWorkspace } from '../../components/panel/thread-workspace';
import type { ConversationThreadSnapshot, DraftVariant, Turn } from '../../core/messages';

describe('thread workspace model', () => {
  it('orders turns chronologically and groups variants by ranked turn', () => {
    const snapshot = threadSnapshot({ latestTurnId: 'turn-2' });

    const workspace = buildThreadWorkspace(snapshot);

    expect(workspace.totalVariants).toBe(3);
    expect(workspace.groups.map((group) => group.turn.turnId)).toEqual(['turn-1', 'turn-2']);
    expect(workspace.groups.map((group) => group.isLatest)).toEqual([false, true]);
    expect(workspace.groups[0].variants.map((variant) => variant.variantId)).toEqual(['variant-2', 'variant-1']);
    expect(workspace.groups[1].variants.map((variant) => ({ id: variant.variantId, current: variant.isCurrent, status: variant.status }))).toEqual([
      { id: 'variant-3', current: true, status: 'accepted' },
    ]);
  });

  it('uses the newest turn as latest when the snapshot omits latestTurnId', () => {
    const snapshot = threadSnapshot({ latestTurnId: undefined });

    const workspace = buildThreadWorkspace(snapshot);

    expect(workspace.groups.map((group) => [group.turn.turnId, group.isLatest])).toEqual([
      ['turn-1', false],
      ['turn-2', true],
    ]);
  });
});

function threadSnapshot({ latestTurnId }: { latestTurnId?: string }): ConversationThreadSnapshot {
  return {
    thread: {
      threadId: 'thread-1',
      sessionId: 'session-1',
      source: {
        selectedText: 'Can you answer these questions?',
        sourceUrl: 'https://example.com/thread',
        sourceDomain: 'example.com',
        pageTitle: 'Example',
      },
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:03:00.000Z',
      latestTurnId,
    },
    turns: [
      turn('turn-2', 'Make it warmer', '2026-01-01T00:02:00.000Z'),
      turn('turn-1', 'Generate reply drafts', '2026-01-01T00:01:00.000Z'),
    ],
    variants: [
      variant('variant-1', 'turn-1', 1, 'First turn second draft'),
      variant('variant-3', 'turn-2', 0, 'Accepted refinement', true, 'accepted'),
      variant('variant-2', 'turn-1', 0, 'First turn first draft'),
    ],
  };
}

function turn(turnId: string, instruction: string, createdAt: string): Turn {
  return {
    turnId,
    threadId: 'thread-1',
    instruction,
    source: {
      selectedText: 'Can you answer these questions?',
      sourceUrl: 'https://example.com/thread',
      sourceDomain: 'example.com',
      pageTitle: 'Example',
    },
    tone: 'friendly',
    generationStatus: 'completed',
    createdAt,
    updatedAt: createdAt,
  };
}

function variant(
  variantId: string,
  turnId: string,
  rank: number,
  content: string,
  isCurrent = false,
  status: DraftVariant['status'] = 'generated',
): DraftVariant {
  return {
    variantId,
    turnId,
    tone: 'friendly',
    content,
    rank,
    status,
    isCurrent,
    createdAt: `2026-01-01T00:0${rank}:00.000Z`,
    updatedAt: `2026-01-01T00:0${rank}:00.000Z`,
  };
}
