import type {
  ConversationThreadSnapshot,
  GenerationRun,
  GenerationRunExecutionState,
  GenerationRunLiveFeedAttachment,
  GenerationRunStatus,
  WorkspaceSession,
} from './messages';

export type RestoredRunRecoverySource = 'active_run_id' | 'execution_state' | 'latest_recoverable_run';

export type RestoredRunRecoveryDecision =
  | { kind: 'reattach_live'; run: GenerationRun; source: RestoredRunRecoverySource }
  | { kind: 'reconcile_stale'; run: GenerationRun; source: RestoredRunRecoverySource }
  | { kind: 'hydrate_active'; runId: string; source: 'active_run_id' }
  | { kind: 'interrupted_retryable'; runId: string; turnId: string; source: 'latest_recoverable_run' }
  | { kind: 'none' };

export type HydratedRunRecoveryDecision =
  | { kind: 'terminal_snapshot'; run: GenerationRun }
  | { kind: 'reattach_live'; run: GenerationRun }
  | { kind: 'reconcile_stale'; run: GenerationRun };

interface ChooseRestoredRunRecoveryInput {
  session: WorkspaceSession;
  thread?: ConversationThreadSnapshot | null;
  executionState?: GenerationRunExecutionState | null;
}

export function chooseRestoredRunRecoveryDecision({
  session,
  thread,
  executionState,
}: ChooseRestoredRunRecoveryInput): RestoredRunRecoveryDecision {
  if (session.activeRunId) {
    const liveRun = executionState?.live.find((run) => run.runId === session.activeRunId);

    if (liveRun) {
      return { kind: 'reattach_live', run: liveRun, source: 'active_run_id' };
    }

    const staleRun = executionState?.stale.find((run) => run.runId === session.activeRunId);

    if (staleRun) {
      return { kind: 'reconcile_stale', run: staleRun, source: 'active_run_id' };
    }

    const activeRun = executionState?.active.find((run) => run.runId === session.activeRunId);

    if (activeRun) {
      return { kind: 'reconcile_stale', run: activeRun, source: 'active_run_id' };
    }

    return { kind: 'hydrate_active', runId: session.activeRunId, source: 'active_run_id' };
  }

  const relevantLiveRun = executionState?.live.find((run) => isRelevantRun(session, thread, run));

  if (relevantLiveRun) {
    return { kind: 'reattach_live', run: relevantLiveRun, source: 'execution_state' };
  }

  const relevantStaleRun = executionState?.stale.find((run) => isRelevantRun(session, thread, run));

  if (relevantStaleRun) {
    return { kind: 'reconcile_stale', run: relevantStaleRun, source: 'execution_state' };
  }

  const recoverableRun = thread?.latestRecoverableRun;

  if (recoverableRun?.recoverable) {
    return {
      kind: 'interrupted_retryable',
      runId: recoverableRun.runId,
      turnId: recoverableRun.turnId,
      source: 'latest_recoverable_run',
    };
  }

  return { kind: 'none' };
}

export function classifyHydratedRunRecovery(
  run: GenerationRun,
  executionState?: GenerationRunExecutionState | null,
  liveFeedAttachment?: GenerationRunLiveFeedAttachment | null,
): HydratedRunRecoveryDecision {
  if (isTerminalGenerationRunStatus(run.status)) {
    return { kind: 'terminal_snapshot', run };
  }

  if (liveFeedAttachment?.mode === 'live_attached' && liveFeedAttachment.liveAttached) {
    return { kind: 'reattach_live', run };
  }

  if (liveFeedAttachment?.mode === 'stale') {
    return { kind: 'reconcile_stale', run };
  }

  if (liveFeedAttachment?.mode === 'replay_only') {
    return { kind: 'reconcile_stale', run };
  }

  if (executionState?.stale.some((candidate) => candidate.runId === run.runId)) {
    return { kind: 'reconcile_stale', run };
  }

  if (executionState?.live.some((candidate) => candidate.runId === run.runId)) {
    return { kind: 'reattach_live', run };
  }

  if (executionState) {
    return { kind: 'reconcile_stale', run };
  }

  return { kind: 'reattach_live', run };
}

export function isTerminalGenerationRunStatus(status: GenerationRunStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'interrupted';
}

function isRelevantRun(
  session: WorkspaceSession,
  thread: ConversationThreadSnapshot | null | undefined,
  run: GenerationRun,
): boolean {
  if (run.sessionId !== session.sessionId) {
    return false;
  }

  if (session.activeThreadId && run.threadId !== session.activeThreadId) {
    return false;
  }

  if (thread && run.threadId !== thread.thread.threadId) {
    return false;
  }

  if (session.activeTurnId && run.turnId !== session.activeTurnId) {
    return false;
  }

  return true;
}
