import { describe, expect, it } from 'vitest';

import {
  chooseRestoredRunRecoveryDecision,
  classifyHydratedRunRecovery,
} from '../../core/generation-run-recovery';
import type {
  ConversationThreadSnapshot,
  GenerationRun,
  GenerationRunExecutionState,
  GenerationRunRestoreCandidate,
  WorkspaceSession,
} from '../../core/messages';

describe('generation run recovery decisions', () => {
  it('reattaches an active session run when runtime marks it live', () => {
    const run = generationRun({ runId: 'run-live', status: 'streaming' });

    expect(chooseRestoredRunRecoveryDecision({
      session: workspaceSession({ activeRunId: run.runId }),
      thread: threadSnapshot(),
      executionState: executionState({ live: [run] }),
    })).toMatchObject({
      kind: 'reattach_live',
      run: { runId: 'run-live' },
      source: 'active_run_id',
    });
  });

  it('reconciles an active session run when runtime marks it stale', () => {
    const run = generationRun({ runId: 'run-stale', status: 'streaming' });

    expect(chooseRestoredRunRecoveryDecision({
      session: workspaceSession({ activeRunId: run.runId }),
      thread: threadSnapshot(),
      executionState: executionState({ stale: [run] }),
    })).toMatchObject({
      kind: 'reconcile_stale',
      run: { runId: 'run-stale' },
      source: 'active_run_id',
    });
  });

  it('finds a relevant live run from execution state when activeRunId is missing', () => {
    const run = generationRun({ runId: 'run-live', status: 'active' });

    expect(chooseRestoredRunRecoveryDecision({
      session: workspaceSession(),
      thread: threadSnapshot(),
      executionState: executionState({ live: [run] }),
    })).toMatchObject({
      kind: 'reattach_live',
      run: { runId: 'run-live' },
      source: 'execution_state',
    });
  });

  it('prefers a feed-attached candidate over heartbeat-live candidates during discovery', () => {
    const staleHeartbeatRun = generationRun({ runId: 'run-stale-heartbeat', status: 'streaming' });
    const liveFeedRun = generationRun({ runId: 'run-live-feed', status: 'streaming', turnId: 'turn-2' });

    expect(chooseRestoredRunRecoveryDecision({
      session: workspaceSession({ activeTurnId: undefined }),
      thread: threadSnapshot(),
      executionState: executionState({
        restoreCandidates: [
          restoreCandidate(staleHeartbeatRun, {
            restoreMode: 'stale',
            liveAttached: false,
            replayAvailable: true,
            reason: 'active_run_without_live_producer',
          }),
          restoreCandidate(liveFeedRun, {
            restoreMode: 'live_attached',
            liveAttached: true,
            replayAvailable: true,
            reason: 'producer_attached',
          }),
        ],
      }),
    })).toMatchObject({
      kind: 'reattach_live',
      run: { runId: 'run-live-feed' },
      source: 'execution_state',
    });
  });

  it('treats replay-only discovery candidates as stale recovery instead of live reattach', () => {
    const run = generationRun({ runId: 'run-replay-only', status: 'streaming' });

    expect(chooseRestoredRunRecoveryDecision({
      session: workspaceSession({ activeRunId: run.runId }),
      thread: threadSnapshot(),
      executionState: executionState({
        restoreCandidates: [
          restoreCandidate(run, {
            restoreMode: 'replay_only',
            liveAttached: false,
            replayAvailable: true,
            reason: 'no_live_producer',
          }),
        ],
      }),
    })).toMatchObject({
      kind: 'reconcile_stale',
      run: { runId: 'run-replay-only' },
      source: 'active_run_id',
    });
  });

  it('uses stale feed truth over heartbeat-live hints during discovery', () => {
    const run = generationRun({ runId: 'run-stale-feed', status: 'streaming' });

    expect(chooseRestoredRunRecoveryDecision({
      session: workspaceSession({ activeRunId: run.runId }),
      thread: threadSnapshot(),
      executionState: executionState({
        restoreCandidates: [
          restoreCandidate(run, {
            restoreMode: 'stale',
            liveAttached: false,
            replayAvailable: false,
            reason: 'active_run_without_live_producer',
          }),
        ],
      }),
    })).toMatchObject({
      kind: 'reconcile_stale',
      run: { runId: 'run-stale-feed' },
      source: 'active_run_id',
    });
  });

  it('falls back to interrupted retryable state from the thread projection', () => {
    expect(chooseRestoredRunRecoveryDecision({
      session: workspaceSession(),
      thread: threadSnapshot({
        latestRecoverableRun: {
          runId: 'run-interrupted',
          turnId: 'turn-1',
          status: 'interrupted',
          recoverable: true,
        },
      }),
      executionState: executionState({}),
    })).toEqual({
      kind: 'interrupted_retryable',
      runId: 'run-interrupted',
      turnId: 'turn-1',
      source: 'latest_recoverable_run',
    });
  });

  it('treats terminal hydrated runs as snapshot-only recovery', () => {
    const run = generationRun({ runId: 'run-complete', status: 'completed' });

    expect(classifyHydratedRunRecovery(run, executionState({ live: [run] }))).toMatchObject({
      kind: 'terminal_snapshot',
      run: { runId: 'run-complete' },
    });
  });

  it('does not reattach active runs that execution state already classifies as stale', () => {
    const run = generationRun({ runId: 'run-stale', status: 'streaming' });

    expect(classifyHydratedRunRecovery(run, executionState({ stale: [run] }))).toMatchObject({
      kind: 'reconcile_stale',
      run: { runId: 'run-stale' },
    });
  });

  it('reattaches hydrated active runs only when the runtime feed is live-attached', () => {
    const run = generationRun({ runId: 'run-live', status: 'streaming' });

    expect(classifyHydratedRunRecovery(run, executionState({ stale: [run] }), {
      mode: 'live_attached',
      liveAttached: true,
      replayAvailable: true,
      subscriberCount: 0,
      reason: 'producer_attached',
    })).toMatchObject({
      kind: 'reattach_live',
      run: { runId: 'run-live' },
    });
  });

  it('reconciles hydrated active runs when runtime feed is replay-only despite live execution state', () => {
    const run = generationRun({ runId: 'run-replay-only', status: 'streaming' });

    expect(classifyHydratedRunRecovery(run, executionState({ live: [run] }), {
      mode: 'replay_only',
      liveAttached: false,
      replayAvailable: true,
      subscriberCount: 0,
      reason: 'no_live_producer',
    })).toMatchObject({
      kind: 'reconcile_stale',
      run: { runId: 'run-replay-only' },
    });
  });

  it('reconciles hydrated active runs when runtime feed is explicitly stale', () => {
    const run = generationRun({ runId: 'run-stale-feed', status: 'active' });

    expect(classifyHydratedRunRecovery(run, executionState({ live: [run] }), {
      mode: 'stale',
      liveAttached: false,
      replayAvailable: false,
      subscriberCount: 0,
      reason: 'active_run_without_live_producer',
    })).toMatchObject({
      kind: 'reconcile_stale',
      run: { runId: 'run-stale-feed' },
    });
  });
});

function workspaceSession(overrides: Partial<WorkspaceSession> = {}): WorkspaceSession {
  return {
    sessionId: 'session-1',
    tabId: 1,
    pageUrl: 'https://example.com/thread',
    latestContext: {
      selectedText: 'Please reply.',
      sourceUrl: 'https://example.com/thread',
      activeView: 'replies',
      tone: 'friendly',
    },
    status: 'active',
    activeThreadId: 'thread-1',
    activeTurnId: 'turn-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function threadSnapshot(overrides: Partial<ConversationThreadSnapshot> = {}): ConversationThreadSnapshot {
  return {
    thread: {
      threadId: 'thread-1',
      sessionId: 'session-1',
      source: {
        selectedText: 'Please reply.',
        sourceUrl: 'https://example.com/thread',
      },
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      latestTurnId: 'turn-1',
    },
    turns: [],
    variants: [],
    ...overrides,
  };
}

function generationRun(overrides: Partial<GenerationRun> = {}): GenerationRun {
  return {
    runId: 'run-1',
    sessionId: 'session-1',
    threadId: 'thread-1',
    turnId: 'turn-1',
    status: 'active',
    leaseOwner: 'extension-background',
    claimedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function restoreCandidate(
  run: GenerationRun,
  overrides: Partial<GenerationRunRestoreCandidate> = {},
): GenerationRunRestoreCandidate {
  return {
    runId: run.runId,
    sessionId: run.sessionId,
    threadId: run.threadId,
    turnId: run.turnId,
    status: run.status,
    leaseOwner: run.leaseOwner,
    restoreMode: 'live_attached',
    liveAttached: true,
    replayAvailable: true,
    subscriberCount: 0,
    recoverable: true,
    stale: false,
    interrupted: false,
    claimedAt: run.claimedAt,
    heartbeatAt: run.heartbeatAt,
    interruptedAt: run.interruptedAt,
    lastActivityAt: run.heartbeatAt ?? run.claimedAt,
    updatedAt: run.updatedAt,
    ...overrides,
  };
}

function executionState({
  active = [],
  live = [],
  stale = [],
  feedAttachments = {},
  restoreCandidates = [],
}: Partial<Pick<GenerationRunExecutionState, 'active' | 'live' | 'stale' | 'feedAttachments' | 'restoreCandidates'>>): GenerationRunExecutionState {
  return {
    checkedAt: '2026-01-01T00:00:00.000Z',
    staleAfterSeconds: 30,
    active,
    live,
    stale,
    feedAttachments,
    restoreCandidates,
  };
}
