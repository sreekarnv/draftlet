import type {
  ConversationThreadSnapshot,
  GenerationRun,
  GenerationRunExecutionState,
  GenerationRunLiveFeedAttachment,
  GenerationRunRestoreCandidate,
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
    const restoreCandidate = findRestoreCandidate(executionState, session.activeRunId);
    const restoreCandidateDecision = restoreCandidate
      ? decisionFromRestoreCandidate(restoreCandidate, 'active_run_id')
      : null;

    if (restoreCandidateDecision) {
      return restoreCandidateDecision;
    }

    return { kind: 'hydrate_active', runId: session.activeRunId, source: 'active_run_id' };
  }

  const restoreCandidate = chooseRankedRelevantRestoreCandidate(session, thread, executionState);

  if (restoreCandidate) {
    const decision = decisionFromRestoreCandidate(restoreCandidate, 'execution_state');

    if (decision) {
      return decision;
    }
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

  if (!liveFeedAttachment) {
    return { kind: 'reconcile_stale', run };
  }

  return { kind: 'reattach_live', run };
}

export function isTerminalGenerationRunStatus(status: GenerationRunStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'interrupted';
}

function findRestoreCandidate(
  executionState: GenerationRunExecutionState | null | undefined,
  runId: string,
): GenerationRunRestoreCandidate | undefined {
  return executionState?.restoreCandidates.find((candidate) => candidate.runId === runId);
}

function chooseRankedRelevantRestoreCandidate(
  session: WorkspaceSession,
  thread: ConversationThreadSnapshot | null | undefined,
  executionState: GenerationRunExecutionState | null | undefined,
): GenerationRunRestoreCandidate | null {
  if (!executionState?.restoreCandidates.length) {
    return null;
  }

  return executionState.restoreCandidates
    .filter((candidate) => isRelevantRestoreCandidate(session, thread, candidate))
    .sort((left, right) => {
      const rankDifference = restoreCandidateRank(left) - restoreCandidateRank(right);

      if (rankDifference !== 0) {
        return rankDifference;
      }

      return restoreCandidateTimestamp(right) - restoreCandidateTimestamp(left);
    })[0] ?? null;
}

function isRelevantRestoreCandidate(
  session: WorkspaceSession,
  thread: ConversationThreadSnapshot | null | undefined,
  candidate: GenerationRunRestoreCandidate,
): boolean {
  if (candidate.sessionId !== session.sessionId) {
    return false;
  }

  if (session.activeThreadId && candidate.threadId !== session.activeThreadId) {
    return false;
  }

  if (thread && candidate.threadId !== thread.thread.threadId) {
    return false;
  }

  if (session.activeTurnId && candidate.turnId !== session.activeTurnId) {
    return false;
  }

  return true;
}

function decisionFromRestoreCandidate(
  candidate: GenerationRunRestoreCandidate,
  source: RestoredRunRecoverySource,
): Extract<RestoredRunRecoveryDecision, { kind: 'reattach_live' | 'reconcile_stale' }> | null {
  const run = restoreCandidateToGenerationRun(candidate);

  if (candidate.restoreMode === 'live_attached' && candidate.liveAttached) {
    return { kind: 'reattach_live', run, source };
  }

  if (candidate.restoreMode === 'replay_only' || candidate.restoreMode === 'stale') {
    return { kind: 'reconcile_stale', run, source };
  }

  return null;
}

function restoreCandidateRank(candidate: GenerationRunRestoreCandidate): number {
  if (candidate.restoreMode === 'live_attached' && candidate.liveAttached) {
    return 0;
  }

  if (candidate.restoreMode === 'replay_only') {
    return 1;
  }

  if (candidate.restoreMode === 'stale') {
    return 2;
  }

  return 3;
}

function restoreCandidateTimestamp(candidate: GenerationRunRestoreCandidate): number {
  const value = candidate.lastActivityAt ?? candidate.heartbeatAt ?? candidate.claimedAt ?? candidate.updatedAt;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function restoreCandidateToGenerationRun(candidate: GenerationRunRestoreCandidate): GenerationRun {
  return {
    runId: candidate.runId,
    sessionId: candidate.sessionId,
    threadId: candidate.threadId,
    turnId: candidate.turnId,
    status: candidate.status,
    leaseOwner: candidate.leaseOwner,
    claimedAt: candidate.claimedAt,
    heartbeatAt: candidate.heartbeatAt,
    interruptedAt: candidate.interruptedAt,
    createdAt: candidate.claimedAt,
    updatedAt: candidate.updatedAt,
  };
}
