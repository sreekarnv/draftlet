import { DEFAULT_TONE } from '../constants';
import {
  cancelReplyGenerationRunExecution,
  checkServerHealth,
  claimGenerationRun,
  getActiveGenerationRuns,
  getConversationThreadSnapshot,
  getGenerationRunExecutionState,
  patchDraftVariantState,
  patchTurnStatus,
  putConversationThread,
  putTurn,
  putWorkspaceSession,
  reconcileGenerationRuns,
  startReplyGenerationRunExecution,
} from '../runtime-api';
import type {
  CancelDraftGenerationResult,
  ConversationThread,
  ConversationThreadSnapshot,
  DraftVariant,
  DraftVariantStateResult,
  DraftletError,
  DraftletSidePanelContext,
  StartDraftGenerationResult,
  Turn,
} from '../messages';
import type { GenerationMode } from '../types';
import { GENERATION_RUN_STALE_AFTER_SECONDS, localGenerationTransportByRunId, sessions, threads } from './state';
import {
  createDraftletError,
  createGenerationId,
  emitConversationThreadUpdated,
  emitWorkspaceSessionUpdated,
  findTurn,
  isInProgressTurn,
  latestGenerationTurn,
} from './shared-helpers';
import {
  cancelLocalGenerationTransport,
  clearLocalGenerationTransport,
  ensureThreadSnapshotForGeneration,
  finalizeGenerationRunStatus,
  getRestorableThreadSnapshot,
  hasLocalGenerationTransport,
  hydrateAndEmitRunProgress,
  hydrateAndEmitThreadSnapshot,
  hydrateWorkspaceSessionFromRuntime,
  resolveGenerationSession,
  streamRuntimeRunEvents,
} from './runtime-run-state';
import { retryPendingRecaptureDiagnosticsPublish } from './diagnostics-coordinator';

export async function handleStartDraftGeneration(
  sessionId: string,
  options: Pick<DraftletSidePanelContext, 'tone' | 'activeView'> & { instruction?: string; mode?: GenerationMode },
): Promise<StartDraftGenerationResult> {
  const session = sessions.getBySessionId(sessionId);

  if (!session) {
    return {
      started: false,
      error: createDraftletError('session_not_found', 'Draftlet session was not found for this tab.', true, sessionId),
    };
  }

  const selectedText = session.latestContext.selectedText.trim();

  if (!selectedText) {
    return {
      started: false,
      sessionId,
      error: createDraftletError('missing_context', 'Select text on a page before generating replies.', true, sessionId),
    };
  }

  await handleCancelDraftGeneration(sessionId);
  const conflict = await getLiveRuntimeGenerationConflict(sessionId);

  if (conflict) {
    return {
      started: false,
      sessionId,
      threadId: conflict.threadId,
      turnId: conflict.turnId,
      error: createDraftletError(
        conflict.turnId === sessions.getBySessionId(sessionId)?.activeTurnId
          ? 'generation_run_turn_active'
          : 'generation_run_session_active',
        'A draft generation is already active for this session.',
        true,
        conflict.runId,
      ),
    };
  }

  const mode = options.mode ?? 'initial';
  const instruction = normalizeInstruction(options.instruction, mode);

  if (mode === 'refinement' && !instruction) {
    return {
      started: false,
      sessionId,
      error: createDraftletError('missing_instruction', 'Add a follow-up instruction before refining drafts.', true, sessionId),
    };
  }

  const tone = options.tone ?? session.latestContext.tone ?? DEFAULT_TONE;
  const context = {
    ...session.latestContext,
    selectedText,
    tone,
    activeView: options.activeView ?? session.latestContext.activeView,
  };
  let updatedSession = sessions.updateContext(sessionId, context) ?? session;
  const threadSnapshot = await ensureThreadSnapshotForGeneration(updatedSession, context, mode);

  if (!threadSnapshot) {
    return {
      started: false,
      sessionId,
      error: createDraftletError('thread_not_found', 'Draftlet thread was not found for this session.', true, sessionId),
    };
  }

  updatedSession = sessions.setActiveThread(sessionId, threadSnapshot.thread.threadId) ?? updatedSession;

  const turnResult = threads.createTurn({
    threadId: threadSnapshot.thread.threadId,
    context,
    tone: context.tone ?? DEFAULT_TONE,
    instruction: instruction ?? 'Generate reply drafts',
  });

  if (!turnResult) {
    return {
      started: false,
      sessionId,
      error: createDraftletError('thread_not_found', 'Draftlet thread was not found for this session.', true, sessionId),
    };
  }

  const generationId = createGenerationId();
  const thread = turnResult.snapshot.thread;
  const turn = turnResult.turn;

  try {
    await putWorkspaceSession(updatedSession);
    await putConversationThread(thread);
    await putTurn(turn);
  } catch (error) {
    return {
      started: false,
      sessionId,
      threadId: thread.threadId,
      turnId: turn.turnId,
      error: createDraftletError(
        'runtime_persistence_failed',
        error instanceof Error ? error.message : 'Could not persist Draftlet session state.',
        true,
        generationId,
      ),
    };
  }

  const startedSnapshot = threads.updateTurnStatus(turn.turnId, 'started') ?? turnResult.snapshot;
  const startedTurn = findTurn(startedSnapshot, turn.turnId) ?? { ...turn, generationStatus: 'started' as const };

  try {
    await patchTurnStatus(turn.turnId, 'started');
  } catch {
    // Runtime persistence already has the queued turn; a later stream transition will reconcile status.
  }

  try {
    await claimGenerationRun({
      runId: generationId,
      sessionId,
      threadId: thread.threadId,
      turnId: turn.turnId,
      leaseOwner: 'extension-background',
      staleAfterSeconds: GENERATION_RUN_STALE_AFTER_SECONDS,
    });
  } catch (error) {
    return {
      started: false,
      sessionId,
      threadId: thread.threadId,
      turnId: turn.turnId,
      error: createDraftletError(
        'generation_run_claim_failed',
        error instanceof Error ? error.message : 'Could not claim a runtime generation run.',
        true,
        generationId,
      ),
    };
  }

  const abortController = new AbortController();
  localGenerationTransportByRunId.set(generationId, { sessionId, abortController });
  const generatingSession = await hydrateWorkspaceSessionFromRuntime(sessionId, updatedSession)
    ?? sessions.setActiveRun(sessionId, {
      runId: generationId,
      threadId: thread.threadId,
      turnId: turn.turnId,
    })
    ?? updatedSession;

  void emitWorkspaceSessionUpdated(generatingSession);
  void emitConversationThreadUpdated(sessionId, startedSnapshot);
  void runDraftGeneration(generatingSession.sessionId, context, generationId, mode, thread, startedTurn, abortController.signal);

  return {
    started: true,
    sessionId,
    generationId,
    threadId: thread.threadId,
    turnId: turn.turnId,
  };
}

export async function handleCancelDraftGeneration(sessionId?: string, generationId?: string): Promise<CancelDraftGenerationResult> {
  const session = resolveGenerationSession(sessionId, generationId);

  if (!session) {
    return { canceled: false };
  }

  let snapshot = await getRestorableThreadSnapshot(session);
  const activeRuns = await getActiveGenerationRuns({ sessionId: session.sessionId }).catch(() => []);
  const latestTurn = snapshot ? latestGenerationTurn(snapshot) : null;
  const activeRun = generationId
    ? activeRuns.find((run) => run.runId === generationId)
    : activeRuns.find((run) => run.runId === session.activeRunId)
      ?? activeRuns.find((run) => !latestTurn || run.turnId === latestTurn.turnId)
      ?? activeRuns[0];
  const runId = generationId ?? activeRun?.runId ?? session.activeRunId;

  if (!snapshot && activeRun) {
    snapshot = await getConversationThreadSnapshot(activeRun.threadId).catch(() => null);
  }

  if (!runId && (!snapshot || !latestTurn || !isInProgressTurn(latestTurn))) {
    return { canceled: false };
  }

  const error = { code: 'generation_cancelled', message: 'Draft generation was cancelled.' };
  const turnId = activeRun?.turnId ?? session.activeTurnId ?? latestTurn?.turnId;

  if (runId) {
    cancelLocalGenerationTransport(runId);
  }

  if (runId && turnId) {
    await cancelReplyGenerationRunExecution(runId)
      .catch(() => finalizeGenerationRunStatus(runId, turnId, 'cancelled', error));
    await finalizeGenerationRunStatus(runId, turnId, 'cancelled', error);
    clearLocalGenerationTransport(runId);
  } else if (turnId) {
    await finalizeGenerationRunStatus(undefined, turnId, 'cancelled', error);
  } else {
    return { canceled: false };
  }

  const refreshedSession = await hydrateWorkspaceSessionFromRuntime(session.sessionId, session);

  if (refreshedSession) {
    void emitWorkspaceSessionUpdated(refreshedSession);
  } else if (runId) {
    const updatedSession = sessions.clearActiveRun(session.sessionId, runId);

    if (updatedSession) {
      void emitWorkspaceSessionUpdated(updatedSession);
    }
  }

  const threadId = activeRun?.threadId ?? session.activeThreadId ?? snapshot?.thread.threadId;
  const refreshedSnapshot = threadId
    ? await hydrateAndEmitThreadSnapshot(session.sessionId, threadId)
    : null;

  if (!refreshedSnapshot && snapshot) {
    const hydratedSnapshot = threads.hydrateSnapshot(snapshot);
    const cancelledSnapshot = threads.updateTurnStatus(turnId, 'cancelled', error) ?? hydratedSnapshot;
    void emitConversationThreadUpdated(session.sessionId, cancelledSnapshot);
  }

  return { canceled: true };
}

export async function runDraftGeneration(
  sessionId: string,
  context: DraftletSidePanelContext,
  generationId: string,
  mode: GenerationMode,
  thread: ConversationThread,
  turn: Turn,
  signal: AbortSignal,
): Promise<void> {
  await Promise.resolve();
  let replayCursor = 0;

  if (!hasLocalGenerationTransport(sessionId, generationId)) {
    return;
  }

  try {
    const connected = await checkServerHealth();

    if (!connected) {
      await emitGenerationFailed(
        sessionId,
        generationId,
        thread.threadId,
        turn.turnId,
        createDraftletError('runtime_unavailable', 'Draftlet server is not reachable.', true, generationId),
      );
      return;
    }

    void retryPendingRecaptureDiagnosticsPublish('draft_generation_health_check');

    const start = await startReplyGenerationRunExecution(
      generationId,
      {
        selected_text: context.selectedText,
        tone: context.tone ?? DEFAULT_TONE,
        source_url: context.sourceUrl,
        source_domain: context.sourceDomain,
        page_title: context.pageTitle,
        session_id: sessionId,
        thread_id: thread.threadId,
        turn_id: turn.turnId,
        run_id: generationId,
        instruction: turn.instruction,
        generation_mode: mode,
      },
    );

    if (start.runId !== generationId) {
      throw new Error('Runtime started a different generation run than requested.');
    }

    const startingProgress = await hydrateAndEmitRunProgress(sessionId, generationId, thread.threadId);
    replayCursor = Math.max(replayCursor, startingProgress?.replayCursor ?? 0);

    replayCursor = await streamRuntimeRunEvents(sessionId, generationId, thread.threadId, replayCursor, signal);

    if (!hasLocalGenerationTransport(sessionId, generationId)) {
      return;
    }

    const completedProgress = await hydrateAndEmitRunProgress(sessionId, generationId, thread.threadId, replayCursor);
    replayCursor = Math.max(replayCursor, completedProgress?.replayCursor ?? 0);

  } catch (error) {
    if (signal.aborted) {
      return;
    }

    await emitGenerationFailed(
      sessionId,
      generationId,
      thread.threadId,
      turn.turnId,
      createDraftletError(
        'generation_failed',
        error instanceof Error ? error.message : 'Could not stream replies from the local server.',
        true,
        generationId,
      ),
    );
  } finally {
    if (hasLocalGenerationTransport(sessionId, generationId)) {
      clearLocalGenerationTransport(generationId);
      const updatedSession = await hydrateWorkspaceSessionFromRuntime(sessionId, sessions.getBySessionId(sessionId) ?? undefined)
        ?? sessions.clearActiveRun(sessionId, generationId);

      if (updatedSession) {
        void emitWorkspaceSessionUpdated(updatedSession);
      }
    }
  }
}

export async function emitGenerationFailed(
  sessionId: string,
  generationId: string,
  threadId: string,
  turnId: string,
  error: DraftletError,
): Promise<void> {
  if (!hasLocalGenerationTransport(sessionId, generationId)) {
    return;
  }

  const failedSnapshot = threads.updateTurnStatus(turnId, 'failed', { code: error.code, message: error.message });

  await finalizeGenerationRunStatus(generationId, turnId, 'failed', { code: error.code, message: error.message });
  const runtimeFailedSnapshot = await hydrateAndEmitThreadSnapshot(sessionId, threadId);

  if (!runtimeFailedSnapshot && failedSnapshot) {
    void emitConversationThreadUpdated(sessionId, failedSnapshot);
  }
}

export async function handleDraftVariantState(
  sessionId: string,
  variantId: string,
  state: { isCurrent?: boolean; status?: DraftVariant['status'] },
): Promise<DraftVariantStateResult> {
  const session = sessions.getBySessionId(sessionId);

  if (!session) {
    return {
      updated: false,
      error: createDraftletError('session_not_found', 'Draftlet session was not found for this tab.', true, variantId),
    };
  }

  try {
    const runtimeSnapshot = await patchDraftVariantState(variantId, state);
    const snapshot = threads.hydrateSnapshot(runtimeSnapshot);
    void emitConversationThreadUpdated(session.sessionId, snapshot);
    return { updated: true, snapshot };
  } catch (error) {
    return {
      updated: false,
      error: createDraftletError(
        'variant_state_update_failed',
        error instanceof Error ? error.message : 'Could not update draft variant state.',
        true,
        variantId,
      ),
    };
  }
}

export async function getLiveRuntimeGenerationConflict(sessionId: string) {
  await reconcileGenerationRuns({
    sessionId,
    staleAfterSeconds: GENERATION_RUN_STALE_AFTER_SECONDS,
    error: {
      code: 'generation_run_stale',
      message: 'A previous draft generation lease became stale before completion.',
    },
  }).catch(() => []);

  const executionState = await getGenerationRunExecutionState({
    sessionId,
    staleAfterSeconds: GENERATION_RUN_STALE_AFTER_SECONDS,
  }).catch(() => null);

  if (!executionState) {
    return null;
  }

  const liveAttachedCandidate = executionState.restoreCandidates.find((candidate) => (
    candidate.restoreMode === 'live_attached' && candidate.liveAttached
  ));

  if (liveAttachedCandidate) {
    return liveAttachedCandidate;
  }

  return null;
}

function normalizeInstruction(instruction: string | undefined, mode: GenerationMode): string | undefined {
  const trimmed = instruction?.trim();

  if (trimmed) {
    return trimmed;
  }

  return mode === 'initial' ? 'Generate reply drafts' : undefined;
}
