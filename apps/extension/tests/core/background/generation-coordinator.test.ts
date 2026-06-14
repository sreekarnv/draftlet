import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ConversationThread,
  ConversationThreadSnapshot,
  DraftletSidePanelContext,
  GenerationRun,
  GenerationRunExecutionState,
  Turn,
  WorkspaceSession,
} from '../../../core/messages';
import {
  handleCancelDraftGeneration,
  handleStartDraftGeneration,
} from '../../../core/background/generation-coordinator';
import {
  localGenerationTransportByRunId,
  sessions,
  threads,
} from '../../../core/background/state';
import {
  cancelLocalGenerationTransport,
  clearLocalGenerationTransport,
  hydrateWorkspaceSessionFromRuntime,
} from '../../../core/background/runtime-run-state';
import type { WorkspaceSessionStore } from '../../../core/workspace-session';
import type { ConversationThreadStore } from '../../../core/conversation-thread';

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

interface SessionSeedOptions {
  sessionId?: string;
  tabId?: number;
  selectedText?: string;
  activeThreadId?: string;
  activeTurnId?: string;
  activeRunId?: string;
}

function seedSession(options: SessionSeedOptions = {}): WorkspaceSession {
  const sessionId = options.sessionId ?? 'session-1';
  const tabId = options.tabId ?? 10;
  const context: DraftletSidePanelContext = {
    selectedText: options.selectedText ?? 'Please reply.',
    sourceUrl: 'https://mail.example.com/thread/1',
    sourceDomain: 'mail.example.com',
    pageTitle: 'Thread',
    tabId,
  };

  const existing = sessions.getBySessionId(sessionId);
  if (!existing) {
    sessions.upsertFromPageContext({ context, tabId, windowId: 1 });
  }

  const seeded = sessions.getByTabId(tabId);
  if (!seeded) {
    throw new Error('Failed to seed session for tests.');
  }

  let next: WorkspaceSession = { ...seeded, sessionId };
  if (options.activeThreadId) {
    next = sessions.setActiveThread(next.sessionId, options.activeThreadId, options.activeTurnId) ?? next;
  }
  if (options.activeRunId) {
    next = sessions.setActiveRun(next.sessionId, {
      runId: options.activeRunId,
      threadId: options.activeThreadId,
      turnId: options.activeTurnId,
    }) ?? next;
  }

  sessions.hydrateSession({ ...next, activeThreadId: options.activeThreadId, activeTurnId: options.activeTurnId, activeRunId: options.activeRunId });
  return sessions.getBySessionId(sessionId) ?? next;
}

function threadSnapshot(threadId: string): ConversationThreadSnapshot {
  return {
    thread: { threadId, sessionId: 'session-1' } as unknown as ConversationThread,
    turns: [] as Turn[],
    variants: [],
  };
}

function generationRun(overrides: Partial<GenerationRun> = {}): GenerationRun {
  return {
    runId: 'generation-1',
    sessionId: 'session-1',
    threadId: 'thread-1',
    turnId: 'turn-1',
    status: 'active',
    leaseOwner: 'extension-background',
    claimedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as GenerationRun;
}

beforeEach(() => {
  for (const fn of Object.values(runtimeApiMocks)) {
    fn.mockReset();
  }
  runtimeApiMocks.checkServerHealth.mockResolvedValue(true);
  runtimeApiMocks.putWorkspaceSession.mockResolvedValue(undefined);
  runtimeApiMocks.putConversationThread.mockResolvedValue(undefined);
  runtimeApiMocks.putTurn.mockResolvedValue(undefined);
  runtimeApiMocks.patchTurnStatus.mockResolvedValue(undefined);
  runtimeApiMocks.claimGenerationRun.mockResolvedValue(generationRun());
  runtimeApiMocks.getActiveGenerationRuns.mockResolvedValue([]);
  runtimeApiMocks.getGenerationRunExecutionState.mockResolvedValue(null);
  runtimeApiMocks.reconcileGenerationRuns.mockResolvedValue([]);
  runtimeApiMocks.cancelReplyGenerationRunExecution.mockResolvedValue({ cancelled: true });
  runtimeApiMocks.getConversationThreadSnapshot.mockResolvedValue(threadSnapshot('thread-1'));
  runtimeApiMocks.getGenerationRunProgress.mockResolvedValue(null);
  runtimeApiMocks.getWorkspaceSessionSnapshot.mockResolvedValue(null);
  runtimeApiMocks.patchGenerationRunStatus.mockResolvedValue(undefined);
  runtimeApiMocks.heartbeatGenerationRun.mockResolvedValue(generationRun());
  runtimeApiMocks.putDraftVariant.mockResolvedValue(undefined);
  runtimeApiMocks.streamReplyGenerationRunEvents.mockResolvedValue(undefined);
  runtimeApiMocks.startReplyGenerationRunExecution.mockResolvedValue({
    runId: 'generation-1',
    started: true,
    live: true,
  });

  // Reset singleton transport map between tests.
  for (const runId of Array.from(localGenerationTransportByRunId.keys())) {
    cancelLocalGenerationTransport(runId);
    clearLocalGenerationTransport(runId);
  }
});

describe('handleStartDraftGeneration', () => {
  it('persists the session, thread, and turn, claims the run, and returns success', async () => {
    const session = seedSession({ sessionId: 'session-happy', tabId: 21 });

    const result = await handleStartDraftGeneration(session.sessionId, {
      tone: 'friendly',
      activeView: 'replies',
    });

    expect(result.started).toBe(true);
    expect(result.sessionId).toBe(session.sessionId);
    expect(result.generationId).toBeDefined();
    expect(result.threadId).toBeDefined();
    expect(result.turnId).toBeDefined();

    const order = [
      runtimeApiMocks.putWorkspaceSession.mock.invocationCallOrder[0],
      runtimeApiMocks.putConversationThread.mock.invocationCallOrder[0],
      runtimeApiMocks.putTurn.mock.invocationCallOrder[0],
      runtimeApiMocks.claimGenerationRun.mock.invocationCallOrder[0],
    ];

    expect(order).toEqual([...order].sort((a, b) => a - b));

    expect(runtimeApiMocks.claimGenerationRun).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: session.sessionId,
        runId: result.generationId,
        leaseOwner: 'extension-background',
        staleAfterSeconds: expect.any(Number),
      }),
    );

    const transportHandle = localGenerationTransportByRunId.get(result.generationId!);
    expect(transportHandle?.sessionId).toBe(session.sessionId);
    expect(transportHandle?.abortController).toBeInstanceOf(AbortController);

    const updated = sessions.getBySessionId(session.sessionId);
    expect(updated?.activeRunId).toBe(result.generationId);
    expect(updated?.activeThreadId).toBe(result.threadId);
    expect(updated?.activeTurnId).toBe(result.turnId);
  });

  it('returns a session_not_found error when the session is unknown', async () => {
    const result = await handleStartDraftGeneration('session-missing', {
      tone: 'friendly',
      activeView: 'replies',
    });

    expect(result.started).toBe(false);
    expect(result.error?.code).toBe('session_not_found');
    expect(runtimeApiMocks.claimGenerationRun).not.toHaveBeenCalled();
  });

  it('returns a conflict when a live_attached generation run already exists', async () => {
    const session = seedSession({ sessionId: 'session-conflict', tabId: 22, activeThreadId: 'thread-1', activeTurnId: 'turn-1', activeRunId: 'generation-existing' });

    runtimeApiMocks.reconcileGenerationRuns.mockResolvedValueOnce([generationRun({ runId: 'generation-existing' })]);
    runtimeApiMocks.getGenerationRunExecutionState.mockResolvedValueOnce({
      checkedAt: '2026-01-01T00:00:00.000Z',
      staleAfterSeconds: 30,
      restoreCandidates: [
        {
          runId: 'generation-existing',
          sessionId: session.sessionId,
          threadId: 'thread-1',
          turnId: 'turn-1',
          status: 'streaming',
          leaseOwner: 'extension-background',
          restoreMode: 'live_attached',
          liveAttached: true,
          replayAvailable: true,
          subscriberCount: 1,
          recoverable: true,
          stale: false,
          interrupted: false,
          claimedAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:01.000Z',
        },
      ],
    } as GenerationRunExecutionState);

    const result = await handleStartDraftGeneration(session.sessionId, { tone: 'friendly', activeView: 'replies' });

    expect(result.started).toBe(false);
    expect(result.error?.code).toBe('generation_run_turn_active');
    expect(runtimeApiMocks.claimGenerationRun).not.toHaveBeenCalled();
  });

  it('returns a missing_instruction error when refining without an instruction', async () => {
    const session = seedSession({ sessionId: 'session-refine', tabId: 23, activeThreadId: 'thread-1', activeTurnId: 'turn-1' });

    const result = await handleStartDraftGeneration(session.sessionId, {
      tone: 'friendly',
      activeView: 'replies',
      mode: 'refinement',
    });

    expect(result.started).toBe(false);
    expect(result.error?.code).toBe('missing_instruction');
    expect(runtimeApiMocks.claimGenerationRun).not.toHaveBeenCalled();
  });

  it('returns a runtime_persistence_failed error when the turn persistence rejects', async () => {
    const session = seedSession({ sessionId: 'session-persist-fail', tabId: 24 });

    runtimeApiMocks.putTurn.mockRejectedValueOnce(new Error('persistence unreachable'));

    const result = await handleStartDraftGeneration(session.sessionId, {
      tone: 'friendly',
      activeView: 'replies',
    });

    expect(result.started).toBe(false);
    expect(result.error?.code).toBe('runtime_persistence_failed');
    expect(runtimeApiMocks.claimGenerationRun).not.toHaveBeenCalled();
    expect(localGenerationTransportByRunId.size).toBe(0);
  });

  it('returns a generation_run_claim_failed error when claim rejects and does not leave a transport', async () => {
    const session = seedSession({ sessionId: 'session-claim-fail', tabId: 25 });

    runtimeApiMocks.claimGenerationRun.mockRejectedValueOnce(new Error('runtime busy'));

    const result = await handleStartDraftGeneration(session.sessionId, {
      tone: 'friendly',
      activeView: 'replies',
    });

    expect(result.started).toBe(false);
    expect(result.error?.code).toBe('generation_run_claim_failed');
    expect(localGenerationTransportByRunId.size).toBe(0);
  });
});

describe('handleCancelDraftGeneration', () => {
  it('cancels the active run, clears the transport, and hydrates the session from runtime', async () => {
    const session = seedSession({ sessionId: 'session-cancel', tabId: 26, activeThreadId: 'thread-1', activeTurnId: 'turn-1', activeRunId: 'generation-cancel' });

    const abortController = new AbortController();
    localGenerationTransportByRunId.set('generation-cancel', {
      sessionId: session.sessionId,
      abortController,
    });

    runtimeApiMocks.getActiveGenerationRuns.mockResolvedValueOnce([generationRun({ runId: 'generation-cancel' })]);

    const result = await handleCancelDraftGeneration(session.sessionId, 'generation-cancel');

    expect(result.canceled).toBe(true);
    expect(abortController.signal.aborted).toBe(true);
    expect(runtimeApiMocks.cancelReplyGenerationRunExecution).toHaveBeenCalledWith('generation-cancel');
    expect(localGenerationTransportByRunId.has('generation-cancel')).toBe(false);
  });

  it('falls back to the session active run id when only sessionId is given', async () => {
    const session = seedSession({ sessionId: 'session-cancel-fallback', tabId: 27, activeThreadId: 'thread-1', activeTurnId: 'turn-1', activeRunId: 'generation-fallback' });

    const abortController = new AbortController();
    localGenerationTransportByRunId.set('generation-fallback', {
      sessionId: session.sessionId,
      abortController,
    });

    runtimeApiMocks.getActiveGenerationRuns.mockResolvedValueOnce([generationRun({ runId: 'generation-fallback' })]);

    const result = await handleCancelDraftGeneration(session.sessionId);

    expect(result.canceled).toBe(true);
    expect(runtimeApiMocks.cancelReplyGenerationRunExecution).toHaveBeenCalledWith('generation-fallback');
    expect(localGenerationTransportByRunId.has('generation-fallback')).toBe(false);
  });

  it('returns canceled:false when no session, run, or in-flight turn exists', async () => {
    const result = await handleCancelDraftGeneration(undefined, 'unknown-run');

    expect(result.canceled).toBe(false);
    expect(runtimeApiMocks.cancelReplyGenerationRunExecution).not.toHaveBeenCalled();
  });
});

void sessions as WorkspaceSessionStore;
void threads as ConversationThreadStore;
void hydrateWorkspaceSessionFromRuntime;
