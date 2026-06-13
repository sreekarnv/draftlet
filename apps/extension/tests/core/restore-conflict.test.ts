import { describe, expect, it } from 'vitest';

import { buildWorkspaceRestoreState } from '../../core/restore-conflict';
import type { ConversationThreadSnapshot, WorkspaceSession } from '../../core/messages';

describe('workspace restore conflict projection', () => {
  it('prioritizes tab choice before interrupted-run retry', () => {
    const state = buildWorkspaceRestoreState({
      session: {
        ...workspaceSession(),
        insertionTargetStatus: 'tab_disambiguation_required',
        plausibleTabs: [
          {
            tabId: 10,
            title: 'Thread A',
            url: 'https://mail.example.com/thread/1',
            matchReason: 'target_url',
          },
          {
            tabId: 11,
            title: 'Thread B',
            url: 'https://mail.example.com/thread/1',
            matchReason: 'target_url',
          },
        ],
      },
      thread: interruptedThreadSnapshot(),
      source: 'history',
    });

    expect(state.status).toBe('needs_action');
    expect(state.primaryAction).toMatchObject({ kind: 'choose_tab', label: 'Choose tab' });
    expect(state.issues.map((issue) => issue.code)).toContain('interrupted_run_retryable');
    expect(state.summary).toBe('Restored session needs a tab choice before recapture.');
  });

  it('prioritizes stale target recovery before retrying an interrupted run', () => {
    const state = buildWorkspaceRestoreState({
      session: {
        ...workspaceSession(),
        insertionTargetStatus: 'stale',
      },
      thread: interruptedThreadSnapshot(),
      source: 'history',
    });

    expect(state.primaryAction).toMatchObject({ kind: 'recapture_target', label: 'Recapture' });
    expect(state.issues.map((issue) => issue.code)).toEqual([
      'restored_session',
      'restored_thread',
      'target_stale',
      'interrupted_run_retryable',
    ]);
  });

  it('marks mismatched active thread context as a conflict', () => {
    const state = buildWorkspaceRestoreState({
      session: {
        ...workspaceSession(),
        activeThreadId: 'thread-other',
      },
      thread: interruptedThreadSnapshot(),
      source: 'current_tab',
    });

    expect(state.status).toBe('conflict');
    expect(state.primaryAction).toBeUndefined();
    expect(state.issues[2]).toMatchObject({
      code: 'active_context_mismatch',
      severity: 'error',
    });
  });
});

function workspaceSession(): WorkspaceSession {
  return {
    sessionId: 'session-1',
    tabId: -1,
    pageUrl: 'https://mail.example.com/thread/1',
    pageTitle: 'Thread',
    latestContext: {
      selectedText: 'Please reply to this.',
      sourceUrl: 'https://mail.example.com/thread/1',
      sourceDomain: 'mail.example.com',
      pageTitle: 'Thread',
      composeTarget: composeTarget(),
    },
    status: 'active',
    activeThreadId: 'thread-1',
    activeTurnId: 'turn-2',
    insertionTarget: composeTarget(),
    insertionTargetStatus: 'stale',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function composeTarget() {
  return {
    targetId: 'compose-1',
    kind: 'textarea' as const,
    pageUrl: 'https://mail.example.com/thread/1',
    origin: 'https://mail.example.com',
    fingerprint: 'textarea|reply',
    lastSeenAt: '2026-01-01T00:00:00.000Z',
  };
}

function interruptedThreadSnapshot(): ConversationThreadSnapshot {
  return {
    thread: {
      threadId: 'thread-1',
      sessionId: 'session-1',
      source: {
        selectedText: 'Please reply to this.',
        sourceUrl: 'https://mail.example.com/thread/1',
        sourceDomain: 'mail.example.com',
        pageTitle: 'Thread',
      },
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:02:00.000Z',
      latestTurnId: 'turn-2',
    },
    turns: [
      {
        turnId: 'turn-1',
        threadId: 'thread-1',
        instruction: 'Generate reply drafts',
        source: {
          selectedText: 'Please reply to this.',
          sourceUrl: 'https://mail.example.com/thread/1',
          sourceDomain: 'mail.example.com',
          pageTitle: 'Thread',
        },
        tone: 'friendly',
        generationStatus: 'completed',
        createdAt: '2026-01-01T00:01:00.000Z',
        updatedAt: '2026-01-01T00:01:00.000Z',
      },
      {
        turnId: 'turn-2',
        threadId: 'thread-1',
        instruction: 'Generate reply drafts',
        source: {
          selectedText: 'Please reply to this.',
          sourceUrl: 'https://mail.example.com/thread/1',
          sourceDomain: 'mail.example.com',
          pageTitle: 'Thread',
        },
        tone: 'friendly',
        generationStatus: 'failed',
        generationErrorCode: 'generation_interrupted',
        generationErrorMessage: 'Draft generation was interrupted before completion.',
        createdAt: '2026-01-01T00:02:00.000Z',
        updatedAt: '2026-01-01T00:02:00.000Z',
      },
    ],
    variants: [],
    latestRecoverableRun: {
      runId: 'generation-2',
      turnId: 'turn-2',
      status: 'interrupted',
      recoverable: true,
      reason: 'generation_interrupted',
      interruptedAt: '2026-01-01T00:02:30.000Z',
      errorCode: 'generation_interrupted',
      errorMessage: 'Draft generation was interrupted before completion.',
    },
  };
}
