import {
  getGenerationRunExecutionState,
  getConversationThreadSnapshot,
  getWorkspaceSessionSnapshot,
  patchTurnStatus,
  reconcileGenerationRuns,
} from '../runtime-api';
import {
  chooseRestoredRunRecoveryDecision,
  classifyHydratedRunRecovery,
  isTerminalGenerationRunStatus,
} from '../generation-run-recovery';
import type {
  ConversationThreadSnapshot,
  WorkspaceRestoreIssue,
  WorkspaceSession,
  WorkspaceSessionResult,
} from '../messages';
import { buildRunRecoveryIssue } from '../restore-conflict';
import { sessions, threads } from './state';
import {
  emitConversationThreadUpdated,
  isInProgressTurn,
  latestGenerationTurn,
} from './shared-helpers';
import {
  GENERATION_RUN_STALE_AFTER_SECONDS,
} from './state';
import {
  hydrateAndEmitRunProgress,
  hydrateWorkspaceSessionFromRuntime,
  reconcileInterruptedGenerationRun,
  subscribeToRuntimeRunEvents,
  hasLocalGenerationTransportForSession,
} from './runtime-run-state';
import { attachAndRecordWorkspaceRestoreState } from './shared-helpers';

export async function restoreRuntimeSnapshot(session: WorkspaceSession): Promise<WorkspaceSessionResult> {
  try {
    const snapshot = await getWorkspaceSessionSnapshot(session.sessionId);

    if (!snapshot) {
      const fallbackSession = attachAndRecordWorkspaceRestoreState(session, null, 'current_tab');
      sessions.hydrateSession(fallbackSession);
      return { session: fallbackSession, restoreState: fallbackSession.restoreState };
    }

    let restoredSession: WorkspaceSession = {
      ...snapshot.session,
      tabId: session.tabId,
      windowId: session.windowId,
      insertionTarget: snapshot.session.insertionTarget ?? session.insertionTarget,
      insertionTargetStatus: 'stale',
      latestContext: {
        ...snapshot.session.latestContext,
        tabId: session.tabId,
        windowId: session.windowId,
        tone: session.latestContext.tone,
        activeView: session.latestContext.activeView,
        composeTarget: snapshot.session.insertionTarget ?? session.insertionTarget,
      },
    };

    sessions.hydrateSession(restoredSession);
    let restoredThread = snapshot.thread;
    const recovery = await recoverRestoredRunFromDurableProgress(restoredSession, restoredThread);
    restoredSession = recovery.session;
    restoredThread = recovery.thread;
    const recoveryIssues = recovery.issues;

    if (!recovery.handled && restoredThread) {
      restoredThread = await reconcileInterruptedGeneration(restoredSession.sessionId, restoredThread);
    }

    if (snapshot.thread) {
      const refreshedSnapshot = await getWorkspaceSessionSnapshot(restoredSession.sessionId).catch(() => null);

      if (refreshedSnapshot?.session) {
        restoredSession = {
          ...refreshedSnapshot.session,
          tabId: session.tabId,
          windowId: session.windowId,
          insertionTarget: refreshedSnapshot.session.insertionTarget ?? session.insertionTarget,
          insertionTargetStatus: 'stale',
          latestContext: {
            ...refreshedSnapshot.session.latestContext,
            tabId: session.tabId,
            windowId: session.windowId,
            tone: session.latestContext.tone,
            activeView: session.latestContext.activeView,
            composeTarget: refreshedSnapshot.session.insertionTarget ?? session.insertionTarget,
          },
        };
      }
    }

    restoredSession = attachAndRecordWorkspaceRestoreState(restoredSession, restoredThread, 'current_tab', recoveryIssues);
    sessions.hydrateSession(restoredSession);

    if (restoredThread) {
      threads.hydrateSnapshot(restoredThread);
      void emitConversationThreadUpdated(restoredSession.sessionId, restoredThread);
    }

    return {
      session: restoredSession,
      thread: restoredThread,
      restoreState: restoredSession.restoreState,
    };
  } catch {
    const fallbackSession = attachAndRecordWorkspaceRestoreState(session, null, 'current_tab');
    sessions.hydrateSession(fallbackSession);
    return { session: fallbackSession, restoreState: fallbackSession.restoreState };
  }
}

export async function recoverRestoredRunFromDurableProgress(
  restoredSession: WorkspaceSession,
  restoredThread: ConversationThreadSnapshot | null,
): Promise<{
  handled: boolean;
  session: WorkspaceSession;
  thread: ConversationThreadSnapshot | null;
  issues: WorkspaceRestoreIssue[];
}> {
  const executionState = await getGenerationRunExecutionState({
    sessionId: restoredSession.sessionId,
    threadId: restoredThread?.thread.threadId ?? restoredSession.activeThreadId,
    turnId: restoredSession.activeTurnId,
    staleAfterSeconds: GENERATION_RUN_STALE_AFTER_SECONDS,
  }).catch(() => null);
  const decision = chooseRestoredRunRecoveryDecision({
    session: restoredSession,
    thread: restoredThread,
    executionState,
  });

  if (decision.kind === 'none' || decision.kind === 'interrupted_retryable') {
    return { handled: false, session: restoredSession, thread: restoredThread, issues: [] };
  }

  const runId = decision.kind === 'hydrate_active' ? decision.runId : decision.run.runId;
  const progress = await hydrateAndEmitRunProgress(
    restoredSession.sessionId,
    runId,
    restoredThread?.thread.threadId,
  );
  const progressThread = progress?.thread ?? restoredThread;
  const progressRun = progress?.run ?? (decision.kind === 'hydrate_active' ? undefined : decision.run);

  if (!progressRun) {
    const issue = buildRunRecoveryIssue('progress_unavailable', recoveryRefsFromDecision(decision, restoredSession));

    if (decision.kind === 'hydrate_active') {
      return { handled: false, session: restoredSession, thread: progressThread, issues: [issue] };
    }

    const reconciledThread = await reconcileInterruptedGenerationRun(decision.run);
    const refreshedSession = await hydrateWorkspaceSessionFromRuntime(restoredSession.sessionId, restoredSession);
    return {
      handled: true,
      session: refreshedSession ?? restoredSession,
      thread: reconciledThread ?? progressThread,
      issues: [issue],
    };
  }

  if (!restoredSession.activeRunId && !isTerminalGenerationRunStatus(progressRun.status)) {
    restoredSession = sessions.setActiveRun(restoredSession.sessionId, {
      runId: progressRun.runId,
      threadId: progressRun.threadId,
      turnId: progressRun.turnId,
    }) ?? restoredSession;
  }

  const hydratedDecision = classifyHydratedRunRecovery(progressRun, progress?.liveFeedAttachment);

  if (hydratedDecision.kind === 'terminal_snapshot') {
    const refreshedSession = await hydrateWorkspaceSessionFromRuntime(restoredSession.sessionId, restoredSession);
    return {
      handled: true,
      session: refreshedSession ?? restoredSession,
      thread: progressThread,
      issues: [],
    };
  }

  if (hydratedDecision.kind === 'reconcile_stale') {
    const reconciledThread = await reconcileInterruptedGenerationRun(progressRun);
    const refreshedSession = await hydrateWorkspaceSessionFromRuntime(restoredSession.sessionId, restoredSession);
    const issueKind = progress?.liveFeedAttachment?.mode === 'replay_only'
      ? 'replay_only_reconciled'
      : 'stale_reconciled';
    return {
      handled: true,
      session: refreshedSession ?? restoredSession,
      thread: reconciledThread ?? progressThread,
      issues: [
        buildRunRecoveryIssue(issueKind, {
          runId: progressRun.runId,
          threadId: progressRun.threadId,
          turnId: progressRun.turnId,
        }),
      ],
    };
  }

  void subscribeToRuntimeRunEvents(
    restoredSession.sessionId,
    progressRun.runId,
    progressRun.threadId ?? progressThread?.thread.threadId,
    progress?.replayCursor ?? 0,
  );

  return { handled: true, session: restoredSession, thread: progressThread, issues: [] };
}

export function recoveryRefsFromDecision(
  decision: Exclude<ReturnType<typeof chooseRestoredRunRecoveryDecision>, { kind: 'none' | 'interrupted_retryable' }>,
  session: WorkspaceSession,
): { runId: string; threadId?: string; turnId?: string } {
  if (decision.kind === 'hydrate_active') {
    return {
      runId: decision.runId,
      threadId: session.activeThreadId,
      turnId: session.activeTurnId,
    };
  }

  return {
    runId: decision.run.runId,
    threadId: decision.run.threadId,
    turnId: decision.run.turnId,
  };
}

export async function reconcileInterruptedGeneration(sessionId: string, snapshot: ConversationThreadSnapshot): Promise<ConversationThreadSnapshot> {
  if (hasLocalGenerationTransportForSession(sessionId)) {
    return snapshot;
  }

  const reconciledRuns = await reconcileGenerationRuns({
    sessionId,
    staleAfterSeconds: 0,
    error: {
      code: 'generation_interrupted',
      message: 'Draft generation was interrupted before completion.',
    },
  }).catch(() => []);

  const refreshedAfterRunReconcile = reconciledRuns.length > 0
    ? await getConversationThreadSnapshot(snapshot.thread.threadId).catch(() => null)
    : null;

  if (refreshedAfterRunReconcile) {
    return refreshedAfterRunReconcile;
  }

  const latestTurn = latestGenerationTurn(snapshot);

  if (!latestTurn || !isInProgressTurn(latestTurn)) {
    return snapshot;
  }

  const error = {
    code: 'generation_interrupted',
    message: 'Draft generation was interrupted before completion.',
  };

  await patchTurnStatus(latestTurn.turnId, 'failed', error).catch(() => null);
  const localSnapshot = threads.hydrateSnapshot(snapshot);
  const failedSnapshot = threads.updateTurnStatus(latestTurn.turnId, 'failed', error) ?? localSnapshot;
  const refreshed = await getConversationThreadSnapshot(snapshot.thread.threadId).catch(() => null);
  return refreshed ?? failedSnapshot;
}
