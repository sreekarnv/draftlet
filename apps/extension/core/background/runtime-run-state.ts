import { getConversationThreadSnapshot, getGenerationRunProgress, getWorkspaceSessionSnapshot, patchGenerationRunStatus, patchTurnStatus, reconcileGenerationRuns, streamReplyGenerationRunEvents } from '../runtime-api';
import { DRAFT_TEXT_DELTA_RECEIVED } from '../messages';
import type {
  ConversationThreadSnapshot,
  DraftletSidePanelContext,
  GenerationRunProgressSnapshot,
  GenerationRunStatus,
  WorkspaceSession,
} from '../messages';
import { sessions, threads, localGenerationTransportByRunId } from './state';
import { emitConversationThreadUpdated, emitDraftletMessage, emitDraftletTabMessage, emitWorkspaceSessionUpdated, getActiveTabId } from './shared-helpers';

export function cancelLocalGenerationTransport(runId: string): void {
  localGenerationTransportByRunId.get(runId)?.abortController.abort();
}

export function clearLocalGenerationTransport(runId: string): void {
  localGenerationTransportByRunId.delete(runId);
}

export function hasLocalGenerationTransportForSession(sessionId: string): boolean {
  for (const transport of localGenerationTransportByRunId.values()) {
    if (transport.sessionId === sessionId) {
      return true;
    }
  }

  return false;
}

export function hasLocalGenerationTransport(sessionId: string, runId: string): boolean {
  return localGenerationTransportByRunId.get(runId)?.sessionId === sessionId;
}

export async function resolveInsertionSession(sessionId?: string): Promise<WorkspaceSession | null> {
  if (sessionId) {
    return sessions.getBySessionId(sessionId);
  }

  const tabId = await getActiveTabId();
  return typeof tabId === 'number' ? sessions.getByTabId(tabId) : null;
}

export function resolveGenerationSession(sessionId?: string, generationId?: string): WorkspaceSession | null {
  if (sessionId) {
    return sessions.getBySessionId(sessionId);
  }

  if (generationId) {
    return sessions.findByActiveRunId(generationId);
  }

  return null;
}

export async function ensureThreadSnapshotForGeneration(
  session: WorkspaceSession,
  context: DraftletSidePanelContext,
  mode: 'initial' | 'refinement',
): Promise<ConversationThreadSnapshot | null> {
  const localSnapshot = session.activeThreadId ? threads.getSnapshot(session.activeThreadId) : threads.getSnapshotForSession(session.sessionId);

  if (localSnapshot) {
    return localSnapshot;
  }

  if (mode === 'refinement' && session.activeThreadId) {
    const runtimeSnapshot = await getWorkspaceSessionSnapshot(session.sessionId).catch(() => null);

    if (runtimeSnapshot?.thread?.thread.threadId === session.activeThreadId) {
      return threads.hydrateSnapshot(runtimeSnapshot.thread);
    }
  }

  if (mode === 'refinement') {
    return null;
  }

  return threads.ensureThreadForSession({
    sessionId: session.sessionId,
    activeThreadId: session.activeThreadId,
    context,
  });
}

export async function getRestorableThreadSnapshot(session: WorkspaceSession): Promise<ConversationThreadSnapshot | null> {
  if (session.activeThreadId) {
    return threads.getSnapshot(session.activeThreadId)
      ?? await getConversationThreadSnapshot(session.activeThreadId).catch(() => null);
  }

  return threads.getSnapshotForSession(session.sessionId);
}

export async function hydrateWorkspaceSessionFromRuntime(
  sessionId: string,
  fallback?: WorkspaceSession,
): Promise<WorkspaceSession | null> {
  const snapshot = await getWorkspaceSessionSnapshot(sessionId).catch(() => null);

  if (!snapshot?.session) {
    return null;
  }

  return sessions.hydrateSession({
    ...snapshot.session,
    tabId: fallback?.tabId ?? snapshot.session.tabId,
    windowId: fallback?.windowId ?? snapshot.session.windowId,
    insertionTarget: snapshot.session.insertionTarget ?? fallback?.insertionTarget,
    insertionTargetStatus: fallback?.insertionTargetStatus ?? snapshot.session.insertionTargetStatus,
    latestContext: {
      ...snapshot.session.latestContext,
      tabId: fallback?.tabId ?? snapshot.session.latestContext.tabId,
      windowId: fallback?.windowId ?? snapshot.session.latestContext.windowId,
      tone: fallback?.latestContext.tone ?? snapshot.session.latestContext.tone,
      activeView: fallback?.latestContext.activeView ?? snapshot.session.latestContext.activeView,
      composeTarget: snapshot.session.insertionTarget ?? fallback?.insertionTarget ?? snapshot.session.latestContext.composeTarget,
    },
  });
}

export async function hydrateAndEmitThreadSnapshot(
  sessionId: string,
  threadId: string,
): Promise<ConversationThreadSnapshot | null> {
  const runtimeSnapshot = await getConversationThreadSnapshot(threadId).catch(() => null);

  if (!runtimeSnapshot) {
    return null;
  }

  const snapshot = threads.hydrateSnapshot(runtimeSnapshot);
  void emitConversationThreadUpdated(sessionId, snapshot);
  return snapshot;
}

export async function hydrateAndEmitRunProgress(
  sessionId: string,
  runId: string,
  fallbackThreadId?: string,
  afterSequence = 0,
): Promise<GenerationRunProgressSnapshot | null> {
  const progress = await getGenerationRunProgress(runId, { afterSequence }).catch(() => null);

  if (!progress) {
    return null;
  }

  const fallbackSession = sessions.getBySessionId(sessionId) ?? undefined;
  const refreshedSession = await hydrateWorkspaceSessionFromRuntime(progress.run.sessionId, fallbackSession);

  if (refreshedSession) {
    void emitWorkspaceSessionUpdated(refreshedSession);
  }

  if (progress.thread) {
    const snapshot = threads.hydrateSnapshot(progress.thread);
    void emitConversationThreadUpdated(progress.run.sessionId, snapshot);
    return {
      ...progress,
      thread: snapshot,
    };
  }

  if (fallbackThreadId) {
    await hydrateAndEmitThreadSnapshot(progress.run.sessionId, fallbackThreadId);
  }

  return progress;
}

export async function streamRuntimeRunEvents(
  sessionId: string,
  runId: string,
  threadId: string | undefined,
  afterSequence: number,
  signal: AbortSignal,
): Promise<number> {
  let replayCursor = afterSequence;
  const pendingHydrations: Promise<unknown>[] = [];

  await streamReplyGenerationRunEvents(runId, {
    signal,
    afterSequence,
    onText(chunk) {
      if (!hasLocalGenerationTransport(sessionId, runId) || !threadId) {
        return;
      }

      const session = sessions.getBySessionId(sessionId);
      const turnId = session?.activeRunId === runId ? session.activeTurnId : undefined;

      if (!session || !turnId) {
        return;
      }

      const message = {
        type: DRAFT_TEXT_DELTA_RECEIVED,
        sessionId,
        generationId: runId,
        threadId,
        turnId,
        text: chunk.text,
        sequence: chunk.sequence,
      } satisfies Parameters<typeof emitDraftletMessage>[0];

      void emitDraftletMessage(message);
      void emitDraftletTabMessage(session.tabId, message);
    },
    onReply(reply) {
      if (!hasLocalGenerationTransport(sessionId, runId)) {
        return;
      }

      if (reply.sequence !== undefined) {
        replayCursor = Math.max(replayCursor, reply.sequence);
      }

      pendingHydrations.push(
        hydrateAndEmitRunProgress(sessionId, runId, threadId, replayCursor).then((progress) => {
          replayCursor = Math.max(replayCursor, progress?.replayCursor ?? 0);
        }),
      );
    },
    onControl(event) {
      if (event.sequence !== undefined) {
        replayCursor = Math.max(replayCursor, event.sequence);
      }

      pendingHydrations.push(
        hydrateAndEmitRunProgress(sessionId, runId, threadId, replayCursor).then((progress) => {
          replayCursor = Math.max(replayCursor, progress?.replayCursor ?? 0);
        }),
      );
    },
  });

  await Promise.allSettled(pendingHydrations);
  return replayCursor;
}

export async function subscribeToRuntimeRunEvents(
  sessionId: string,
  runId: string,
  threadId?: string,
  afterSequence = 0,
): Promise<void> {
  if (hasLocalGenerationTransport(sessionId, runId)) {
    return;
  }

  const abortController = new AbortController();
  localGenerationTransportByRunId.set(runId, { sessionId, abortController });
  let replayCursor = afterSequence;

  try {
    replayCursor = await streamRuntimeRunEvents(sessionId, runId, threadId, afterSequence, abortController.signal);
  } catch (error) {
    if (abortController.signal.aborted) {
      return;
    }

    await hydrateAndEmitRunProgress(sessionId, runId, threadId, replayCursor);
  } finally {
    if (hasLocalGenerationTransport(sessionId, runId)) {
      clearLocalGenerationTransport(runId);
      await hydrateAndEmitRunProgress(sessionId, runId, threadId, replayCursor);
    }
  }
}

export async function finalizeGenerationRunStatus(
  runId: string | undefined,
  turnId: string,
  status: 'streaming' | 'completed' | 'failed' | 'cancelled' | 'interrupted',
  error?: { code?: string; message?: string },
): Promise<void> {
  if (runId) {
    try {
      await patchGenerationRunStatus(runId, status as GenerationRunStatus, error);
      return;
    } catch {
      // Fall back to the durable Turn lifecycle for transitional compatibility.
    }
  }

  const turnStatus = status === 'interrupted' ? 'failed' : status;
  await patchTurnStatus(turnId, turnStatus, error).catch(() => null);
}

export async function reconcileInterruptedGenerationRun(run: {
  sessionId: string;
  threadId: string;
  turnId: string;
}): Promise<ConversationThreadSnapshot | null> {
  await reconcileGenerationRuns({
    sessionId: run.sessionId,
    threadId: run.threadId,
    turnId: run.turnId,
    staleAfterSeconds: 0,
    error: {
      code: 'generation_interrupted',
      message: 'Draft generation was interrupted before completion.',
    },
  }).catch(() => []);

  return getConversationThreadSnapshot(run.threadId).catch(() => null);
}
