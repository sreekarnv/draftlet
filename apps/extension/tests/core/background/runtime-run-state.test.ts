import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ConversationThreadSnapshot,
  DraftVariant,
  GenerationRun,
  GenerationRunLiveFeedAttachment,
  GenerationRunProgressSnapshot,
  Turn,
} from '../../../core/messages';
import {
  cancelLocalGenerationTransport,
  clearLocalGenerationTransport,
  finalizeGenerationRunStatus,
  hasLocalGenerationTransport,
  hasLocalGenerationTransportForSession,
  hydrateAndEmitRunProgress,
  hydrateAndEmitThreadSnapshot,
  reconcileInterruptedGenerationRun,
  streamRuntimeRunEvents,
  subscribeToRuntimeRunEvents,
} from '../../../core/background/runtime-run-state';
import {
  cancelReplyGenerationRunExecution,
  checkServerHealth,
  claimGenerationRun,
  getActiveGenerationRuns,
  getConversationThreadSnapshot,
  getGenerationRunExecutionState,
  getGenerationRunProgress,
  getWorkspaceSessionSnapshot,
  heartbeatGenerationRun,
  patchDraftVariantState,
  patchGenerationRunStatus,
  patchTurnStatus,
  putConversationThread,
  putDraftVariant,
  putTurn,
  putWorkspaceSession,
  reconcileGenerationRuns,
  startReplyGenerationRunExecution,
  streamReplyGenerationRunEvents,
} from '../../../core/runtime-api';
import { localGenerationTransportByRunId, sessions, threads } from '../../../core/background/state';

const runtimeApiMocks = vi.hoisted(() => ({
  cancelReplyGenerationRunExecution: vi.fn(),
  checkServerHealth: vi.fn(),
  claimGenerationRun: vi.fn(),
  getActiveGenerationRuns: vi.fn(),
  getConversationThreadSnapshot: vi.fn(),
  getGenerationRunExecutionState: vi.fn(),
  getGenerationRunProgress: vi.fn(),
  getWorkspaceSessionSnapshot: vi.fn(),
  heartbeatGenerationRun: vi.fn(),
  patchDraftVariantState: vi.fn(),
  patchGenerationRunStatus: vi.fn(),
  patchTurnStatus: vi.fn(),
  putConversationThread: vi.fn(),
  putDraftVariant: vi.fn(),
  putTurn: vi.fn(),
  putWorkspaceSession: vi.fn(),
  reconcileGenerationRuns: vi.fn(),
  startReplyGenerationRunExecution: vi.fn(),
  streamReplyGenerationRunEvents: vi.fn(),
}));

vi.mock('../../../core/runtime-api', () => runtimeApiMocks);

const browserStub = vi.hoisted(() => ({
  runtime: { sendMessage: vi.fn(async () => undefined) },
  tabs: { sendMessage: vi.fn(), get: vi.fn(), update: vi.fn(), query: vi.fn().mockResolvedValue([]) },
  sidePanel: { open: vi.fn() },
}));

vi.stubGlobal('browser', browserStub);

function generationRun(overrides: Partial<GenerationRun> = {}): GenerationRun {
  return {
    runId: 'generation-1',
    sessionId: 'session-1',
    threadId: 'thread-1',
    turnId: 'turn-1',
    status: 'streaming',
    leaseOwner: 'extension-background',
    claimedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:01.000Z',
    ...overrides,
  } as GenerationRun;
}

function progressSnapshot(replayCursor: number, attachment?: GenerationRunLiveFeedAttachment): GenerationRunProgressSnapshot {
  return {
    checkedAt: '2026-01-01T00:00:02.000Z',
    run: generationRun(),
    thread: null,
    events: [],
    replayCursor,
    liveFeedAttachment: attachment,
  };
}

function threadSnapshot(threadId: string): ConversationThreadSnapshot {
  return {
    thread: {
      threadId,
      sessionId: 'session-1',
      source: { selectedText: 'Reply to this.' },
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
    } as never,
    turns: [] as Turn[],
    variants: [] as DraftVariant[],
  };
}

function seedTransport(sessionId: string, runId: string): AbortController {
  const abortController = new AbortController();
  localGenerationTransportByRunId.set(runId, { sessionId, abortController });
  return abortController;
}

beforeEach(() => {
  for (const fn of Object.values(runtimeApiMocks)) {
    fn.mockReset();
  }
  runtimeApiMocks.checkServerHealth.mockResolvedValue(true);
  runtimeApiMocks.patchGenerationRunStatus.mockResolvedValue(undefined);
  runtimeApiMocks.patchTurnStatus.mockResolvedValue(undefined);
  runtimeApiMocks.reconcileGenerationRuns.mockResolvedValue([]);
  runtimeApiMocks.heartbeatGenerationRun.mockResolvedValue(generationRun());
  runtimeApiMocks.claimGenerationRun.mockResolvedValue(generationRun());
  runtimeApiMocks.startReplyGenerationRunExecution.mockResolvedValue({
    runId: 'generation-1',
    started: true,
    live: true,
  });
  runtimeApiMocks.streamReplyGenerationRunEvents.mockResolvedValue(undefined);
  runtimeApiMocks.getConversationThreadSnapshot.mockResolvedValue(null);
  runtimeApiMocks.getGenerationRunProgress.mockResolvedValue(null);
  runtimeApiMocks.getWorkspaceSessionSnapshot.mockResolvedValue(null);
  runtimeApiMocks.getGenerationRunExecutionState.mockResolvedValue(null);
  runtimeApiMocks.getActiveGenerationRuns.mockResolvedValue([]);

  for (const runId of Array.from(localGenerationTransportByRunId.keys())) {
    cancelLocalGenerationTransport(runId);
    clearLocalGenerationTransport(runId);
  }
});

afterEach(() => {
  for (const runId of Array.from(localGenerationTransportByRunId.keys())) {
    cancelLocalGenerationTransport(runId);
    clearLocalGenerationTransport(runId);
  }
});

describe('hydrateAndEmitRunProgress', () => {
  it('returns null when the runtime does not return progress', async () => {
    runtimeApiMocks.getGenerationRunProgress.mockResolvedValueOnce(null);

    const result = await hydrateAndEmitRunProgress('session-1', 'generation-1', 'thread-1');

    expect(result).toBeNull();
  });

  it('hydrates the embedded thread snapshot and returns it on the progress', async () => {
    runtimeApiMocks.getGenerationRunProgress.mockResolvedValueOnce({
      ...progressSnapshot(7),
      thread: threadSnapshot('thread-1'),
    });

    const result = await hydrateAndEmitRunProgress('session-1', 'generation-1', 'thread-1');

    expect(result?.replayCursor).toBe(7);
    expect(result?.thread?.thread.threadId).toBe('thread-1');
  });

  it('falls back to the provided threadId when the progress has no embedded thread', async () => {
    runtimeApiMocks.getGenerationRunProgress.mockResolvedValueOnce(progressSnapshot(3));
    runtimeApiMocks.getConversationThreadSnapshot.mockResolvedValueOnce(threadSnapshot('thread-fallback'));

    await hydrateAndEmitRunProgress('session-1', 'generation-1', 'thread-fallback');

    expect(runtimeApiMocks.getConversationThreadSnapshot).toHaveBeenCalledWith('thread-fallback');
  });
});

describe('subscribeToRuntimeRunEvents', () => {
  it('is a no-op when a transport already exists for the run', async () => {
    seedTransport('session-1', 'generation-1');

    await subscribeToRuntimeRunEvents('session-1', 'generation-1', 'thread-1');

    expect(runtimeApiMocks.streamReplyGenerationRunEvents).not.toHaveBeenCalled();
  });

  it('clears the transport and hydrates a final progress when the stream resolves', async () => {
    runtimeApiMocks.streamReplyGenerationRunEvents.mockImplementationOnce(async (_runId, options) => {
      options.onReply?.({
        text: 'Draft variant',
        variantId: 'variant-1',
        sequence: 5,
      });
    });
    runtimeApiMocks.getGenerationRunProgress.mockResolvedValueOnce(progressSnapshot(5));

    await subscribeToRuntimeRunEvents('session-1', 'generation-1', 'thread-1', 0);

    expect(localGenerationTransportByRunId.has('generation-1')).toBe(false);
    expect(runtimeApiMocks.getGenerationRunProgress).toHaveBeenCalled();
  });

  it('clears the transport and hydrates a final progress when the stream rejects with a non-abort error', async () => {
    runtimeApiMocks.streamReplyGenerationRunEvents.mockRejectedValueOnce(new Error('connection lost'));
    runtimeApiMocks.getGenerationRunProgress.mockResolvedValueOnce(progressSnapshot(1));

    await subscribeToRuntimeRunEvents('session-1', 'generation-1', 'thread-1', 0);

    expect(localGenerationTransportByRunId.has('generation-1')).toBe(false);
    expect(runtimeApiMocks.getGenerationRunProgress).toHaveBeenCalled();
  });

  it('does not call the runtime after the abort signal fires', async () => {
    runtimeApiMocks.streamReplyGenerationRunEvents.mockImplementationOnce(async (_runId, options) => {
      const abort = options.signal;
      return await new Promise((_, reject) => {
        abort?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      });
    });

    const subscription = subscribeToRuntimeRunEvents('session-1', 'generation-1', 'thread-1', 0);

    const transport = localGenerationTransportByRunId.get('generation-1');
    transport?.abortController.abort();

    await subscription;

    expect(localGenerationTransportByRunId.has('generation-1')).toBe(false);
  });
});

describe('streamRuntimeRunEvents replay cursor', () => {
  it('returns the maximum replay cursor observed across all hydrations, not just the synchronous event sequence', async () => {
    seedTransport('session-1', 'generation-1');

    let capturedReplies: Array<{ sequence?: number }> = [];

    runtimeApiMocks.streamReplyGenerationRunEvents.mockImplementationOnce(async (_runId, options) => {
      const replies: Array<{ sequence?: number }> = [];
      options.onReply?.({ text: 'first', variantId: 'variant-1', sequence: 1 });
      options.onReply?.({ text: 'second', variantId: 'variant-2', sequence: 2 });
      options.onReply?.({ text: 'third', variantId: 'variant-3', sequence: 3 });
      capturedReplies = replies;
    });

    runtimeApiMocks.getGenerationRunProgress.mockResolvedValue(progressSnapshot(7));

    const cursor = await streamRuntimeRunEvents('session-1', 'generation-1', 'thread-1', 0, new AbortController().signal);

    expect(cursor).toBeGreaterThanOrEqual(2);
    expect(cursor).toBe(7);
    expect(capturedReplies).toEqual([]);
  });

  it('propagates abort signal errors and does not swallow non-abort failures', async () => {
    seedTransport('session-1', 'generation-1');

    runtimeApiMocks.streamReplyGenerationRunEvents.mockImplementationOnce(async (_runId, options) => {
      options.onReply?.({ text: 'draft', sequence: 1 });
    });
    runtimeApiMocks.getGenerationRunProgress.mockResolvedValueOnce(progressSnapshot(3));

    const cursor = await streamRuntimeRunEvents('session-1', 'generation-1', 'thread-1', 0, new AbortController().signal);

    expect(cursor).toBe(3);
  });
});

describe('hasLocalGenerationTransport helpers', () => {
  it('hasLocalGenerationTransport matches a specific run for the session', () => {
    const abortController = seedTransport('session-1', 'generation-1');

    expect(hasLocalGenerationTransport('session-1', 'generation-1')).toBe(true);
    expect(hasLocalGenerationTransport('session-1', 'other-run')).toBe(false);
    expect(hasLocalGenerationTransport('other-session', 'generation-1')).toBe(false);

    abortController.abort();
  });

  it('hasLocalGenerationTransportForSession matches any run for the session', () => {
    seedTransport('session-1', 'generation-1');
    seedTransport('session-1', 'generation-2');

    expect(hasLocalGenerationTransportForSession('session-1')).toBe(true);
    expect(hasLocalGenerationTransportForSession('session-other')).toBe(false);
  });
});

describe('hydrateAndEmitThreadSnapshot', () => {
  it('returns null when the runtime returns no snapshot', async () => {
    runtimeApiMocks.getConversationThreadSnapshot.mockResolvedValueOnce(null);

    const result = await hydrateAndEmitThreadSnapshot('session-1', 'thread-1');

    expect(result).toBeNull();
  });

  it('hydrates the thread and emits an update', async () => {
    runtimeApiMocks.getConversationThreadSnapshot.mockResolvedValueOnce(threadSnapshot('thread-1'));

    const result = await hydrateAndEmitThreadSnapshot('session-1', 'thread-1');

    expect(result?.thread.threadId).toBe('thread-1');
  });
});

describe('finalizeGenerationRunStatus', () => {
  it('patches the run status when a runId is provided', async () => {
    await finalizeGenerationRunStatus('generation-1', 'turn-1', 'completed');

    expect(runtimeApiMocks.patchGenerationRunStatus).toHaveBeenCalledWith('generation-1', 'completed', undefined);
  });

  it('falls back to patchTurnStatus when patchGenerationRunStatus rejects', async () => {
    runtimeApiMocks.patchGenerationRunStatus.mockRejectedValueOnce(new Error('run lost'));

    await finalizeGenerationRunStatus('generation-1', 'turn-1', 'failed', { code: 'X', message: 'fail' });

    expect(runtimeApiMocks.patchTurnStatus).toHaveBeenCalledWith('turn-1', 'failed', { code: 'X', message: 'fail' });
  });

  it('maps interrupted run status to a failed turn status when no runId is provided', async () => {
    await finalizeGenerationRunStatus(undefined, 'turn-1', 'interrupted', { code: 'X', message: 'm' });

    expect(runtimeApiMocks.patchTurnStatus).toHaveBeenCalledWith('turn-1', 'failed', { code: 'X', message: 'm' });
  });
});

describe('reconcileInterruptedGenerationRun', () => {
  it('returns the latest thread snapshot after reconciling the run', async () => {
    runtimeApiMocks.getConversationThreadSnapshot.mockResolvedValueOnce(threadSnapshot('thread-reconciled'));

    const result = await reconcileInterruptedGenerationRun({
      sessionId: 'session-1',
      threadId: 'thread-reconciled',
      turnId: 'turn-1',
    });

    expect(runtimeApiMocks.reconcileGenerationRuns).toHaveBeenCalled();
    expect(result?.thread.threadId).toBe('thread-reconciled');
  });
});

void sessions;
void threads;
