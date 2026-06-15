import { describe, expect, it } from 'vitest';

import { findPlausibleTabCandidates, isPlausibleSessionTab } from '../../core/tab-disambiguation';
import type { WorkspaceSession } from '../../core/messages';

describe('tab disambiguation', () => {
  it('returns ranked bounded candidates for matching target and session URLs', () => {
    const session = workspaceSession();

    const candidates = findPlausibleTabCandidates([
      { id: 12, windowId: 1, title: 'Inbox', url: 'https://mail.example.com/inbox', active: false, currentWindow: true },
      { id: 11, windowId: 1, title: 'Thread', url: 'https://mail.example.com/thread/1', active: false, currentWindow: true },
      { id: 10, windowId: 1, title: 'Active thread', url: 'https://mail.example.com/thread/1', active: true, currentWindow: true },
      { id: 13, windowId: 2, title: 'Other site', url: 'https://example.org/thread/1' },
    ], session);

    expect(candidates.map((candidate) => ({
      tabId: candidate.tabId,
      matchReason: candidate.matchReason,
      active: candidate.active,
      origin: candidate.origin,
    }))).toEqual([
      { tabId: 10, matchReason: 'target_url', active: true, origin: 'https://mail.example.com' },
      { tabId: 11, matchReason: 'target_url', active: false, origin: 'https://mail.example.com' },
      { tabId: 12, matchReason: 'target_origin', active: false, origin: 'https://mail.example.com' },
    ]);
  });

  it('treats exact session URL as plausible when no target exists', () => {
    const session = {
      ...workspaceSession(),
      insertionTarget: undefined,
      latestContext: {
        ...workspaceSession().latestContext,
        composeTarget: undefined,
      },
    };

    expect(isPlausibleSessionTab({ id: 20, url: 'https://mail.example.com/thread/1' }, session)).toBe(true);
    expect(isPlausibleSessionTab({ id: 21, url: 'https://mail.example.com/thread/2' }, session)).toBe(false);
  });
});

function workspaceSession(): WorkspaceSession {
  return {
    sessionId: 'session-1',
    tabId: -1,
    windowId: undefined,
    pageUrl: 'https://mail.example.com/thread/1',
    pageTitle: 'Thread',
    latestContext: {
      selectedText: 'Reply to this',
      sourceUrl: 'https://mail.example.com/thread/1',
      sourceDomain: 'mail.example.com',
      pageTitle: 'Thread',
      composeTarget: {
        targetId: 'compose-1',
        kind: 'textarea',
        pageUrl: 'https://mail.example.com/thread/1',
        origin: 'https://mail.example.com',
        fingerprint: 'textarea|reply',
        lastSeenAt: '2026-01-01T00:00:00.000Z',
      },
    },
    status: 'active',
    insertionTarget: {
      targetId: 'compose-1',
      kind: 'textarea',
      pageUrl: 'https://mail.example.com/thread/1',
      origin: 'https://mail.example.com',
      fingerprint: 'textarea|reply',
      lastSeenAt: '2026-01-01T00:00:00.000Z',
    },
    insertionTargetStatus: 'stale',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}
