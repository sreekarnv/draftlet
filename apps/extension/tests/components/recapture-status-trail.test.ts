import { describe, expect, it } from 'vitest';

import type { WorkspaceSession } from '../../core/messages';
import { MAX_RECAPTURE_TRAIL_ITEMS } from '../../ui/sidepanel/state';
import {
  appendTrail,
  insertionTargetMessage,
  trailEventForRecapture,
  trailLevelForRecapture,
} from '../../components/panel/recapture-status-trail';

function workspaceSession(overrides: Partial<WorkspaceSession> = {}): WorkspaceSession {
  return {
    sessionId: 'session-1',
    tabId: 10,
    windowId: 1,
    pageUrl: 'https://mail.example.com/thread/1',
    pageTitle: 'Thread',
    latestContext: {
      selectedText: 'Please reply to this thread.',
      sourceUrl: 'https://mail.example.com/thread/1',
      sourceDomain: 'mail.example.com',
      pageTitle: 'Thread',
      tone: 'friendly',
      activeView: 'replies',
    },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:01.000Z',
    ...overrides,
  };
}

describe('appendTrail', () => {
  it('appends a bounded trail item with a timestamp', () => {
    const next = appendTrail([], 'recapture_requested', 'pending', 'Recapture requested.', 7);

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      event: 'recapture_requested',
      level: 'pending',
      message: 'Recapture requested.',
      tabId: 7,
    });
    expect(typeof next[0].at).toBe('string');
    expect(Date.parse(next[0].at)).not.toBeNaN();
  });

  it('keeps only the latest items when over the maximum', () => {
    let trail: ReturnType<typeof appendTrail> = [];
    for (let i = 0; i < MAX_RECAPTURE_TRAIL_ITEMS + 2; i += 1) {
      trail = appendTrail(trail, 'recapture_requested', 'pending', `step ${i}`, i);
    }

    expect(trail).toHaveLength(MAX_RECAPTURE_TRAIL_ITEMS);
    expect(trail[0]).toMatchObject({ tabId: 2, message: 'step 2' });
    expect(trail.at(-1)).toMatchObject({ tabId: MAX_RECAPTURE_TRAIL_ITEMS + 1, message: `step ${MAX_RECAPTURE_TRAIL_ITEMS + 1}` });
  });

  it('does not mutate the input trail', () => {
    const original: ReturnType<typeof appendTrail> = [
      {
        event: 'recapture_requested',
        level: 'pending',
        message: 'previous',
        tabId: 1,
        at: '2026-01-01T00:00:00.000Z',
      },
    ];

    const next = appendTrail(original, 'recapture_succeeded', 'success', 'next', 2);

    expect(original).toHaveLength(1);
    expect(original[0].message).toBe('previous');
    expect(next).toHaveLength(2);
    expect(next[0]).toBe(original[0]);
  });
});

describe('trailEventForRecapture / trailLevelForRecapture', () => {
  it('maps recapture_succeeded to a success trail entry', () => {
    expect(trailEventForRecapture({ outcome: 'recapture_succeeded' } as never)).toBe('recapture_succeeded');
    expect(trailLevelForRecapture({ outcome: 'recapture_succeeded' } as never)).toBe('success');
  });

  it('maps focus and tab-choice outcomes to focus_required warning', () => {
    expect(trailEventForRecapture({ outcome: 'needs_focused_compose_target' } as never)).toBe('focus_required');
    expect(trailEventForRecapture({ outcome: 'tab_choice_acknowledged' } as never)).toBe('focus_required');
    expect(trailLevelForRecapture({ outcome: 'needs_focused_compose_target' } as never)).toBe('warning');
    expect(trailLevelForRecapture({ outcome: 'tab_choice_acknowledged' } as never)).toBe('warning');
  });

  it('falls back to recapture_failed for any other outcome', () => {
    expect(trailEventForRecapture({ outcome: 'recapture_failed' } as never)).toBe('recapture_failed');
    expect(trailLevelForRecapture({ outcome: 'recapture_failed' } as never)).toBe('failed');
    expect(trailEventForRecapture({ outcome: 'chosen_tab_unavailable' } as never)).toBe('recapture_failed');
    expect(trailLevelForRecapture({ outcome: 'chosen_tab_unavailable' } as never)).toBe('failed');
  });
});

describe('insertionTargetMessage', () => {
  it('reports the live target when insertion status is live', () => {
    expect(insertionTargetMessage(workspaceSession({ insertionTargetStatus: 'live' }))).toBe('Ready to insert into the saved compose field.');
  });

  it('reports the stale target guidance when status is stale', () => {
    expect(insertionTargetMessage(workspaceSession({ insertionTargetStatus: 'stale' }))).toBe(
      'Target stale; Draftlet will recheck before inserting.',
    );
  });

  it('reports the unavailable target guidance when status is unavailable', () => {
    expect(insertionTargetMessage(workspaceSession({ insertionTargetStatus: 'unavailable' }))).toBe(
      'Original page is not available. Use Copy for this reply.',
    );
  });

  it('reports the focus guidance when status is needs_focus', () => {
    expect(insertionTargetMessage(workspaceSession({ insertionTargetStatus: 'needs_focus' }))).toBe(
      'Click the compose field on the original page to insert.',
    );
  });

  it('reports the tab disambiguation guidance when status is tab_disambiguation_required', () => {
    expect(insertionTargetMessage(workspaceSession({ insertionTargetStatus: 'tab_disambiguation_required' }))).toBe(
      'Original page is not available. Use Copy for this reply.',
    );
  });

  it('infers stale when a target exists but no status is set', () => {
    expect(
      insertionTargetMessage(
        workspaceSession({
          insertionTarget: {
            targetId: 'compose-1',
            kind: 'textarea',
            pageUrl: 'https://mail.example.com/thread/1',
            fingerprint: 'textarea|reply',
            lastSeenAt: '2026-01-01T00:00:00.000Z',
          },
        }),
      ),
    ).toBe('Target stale; Draftlet will recheck before inserting.');
  });

  it('falls back to needs_recapture when no target and no status are set', () => {
    expect(insertionTargetMessage(workspaceSession())).toBe('Click the compose field on the original page to insert.');
  });
});
