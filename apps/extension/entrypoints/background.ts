import {
  cancelReplyGenerationRunExecution,
  checkServerHealth,
  claimGenerationRun,
  getConversationThreadSnapshot,
  getActiveGenerationRuns,
  getGenerationRunExecutionState,
  getDomainHistory,
  getWorkspaceSessionSnapshot,
  patchDraftVariantState,
  patchGenerationRunStatus,
  patchTurnStatus,
  publishBrowserRecaptureDiagnosticsReport,
  putConversationThread,
  putTurn,
  putWorkspaceSession,
  reconcileGenerationRuns,
  streamReplies,
} from '../core/api';
import { DEFAULT_TONE } from '../core/constants';
import {
  ACCEPT_DRAFT_VARIANT,
  ACTIVATE_RECAPTURE_TAB,
  CANCEL_DRAFT_GENERATION,
  CONVERSATION_THREAD_UPDATED,
  DRAFT_GENERATION_COMPLETED,
  DRAFT_GENERATION_FAILED,
  DRAFT_GENERATION_STARTED,
  GET_CURRENT_WORKSPACE_SESSION,
  GET_INSERTION_TARGET_STATUS,
  GET_DOMAIN_HISTORY,
  GET_RECAPTURE_DIAGNOSTICS,
  GET_RUNTIME_STATUS,
  INSERT_REPLY,
  LAUNCH_SIDE_PANEL,
  PUBLISH_RECAPTURE_DIAGNOSTICS_REPORT,
  RECAPTURE_INSERTION_TARGET,
  REVALIDATE_INSERTION_TARGET,
  RESTORE_DOMAIN_THREAD,
  SET_CURRENT_DRAFT_VARIANT,
  START_DRAFT_GENERATION,
  START_DRAFT_REFINEMENT,
  WORKSPACE_SESSION_UPDATED,
  type ActivateRecaptureTabResult,
  type CancelDraftGenerationResult,
  type ConversationThreadSnapshot,
  type ConversationThread,
  type DraftVariant,
  type DraftVariantStateResult,
  type DraftletError,
  type DomainHistoryResult,
  type DraftletMessage,
  type DraftletSidePanelContext,
  type InsertReplyResult,
  type InsertionTargetStatusResult,
  type LaunchSidePanelResult,
  type PublishRecaptureDiagnosticsReportResult,
  type RecaptureDiagnosticsResult,
  type RecaptureDiagnosticEntry,
  type RecaptureInsertionTargetResult,
  type RestoreDomainThreadResult,
  type RuntimeStatusResult,
  type StartDraftGenerationResult,
  type Turn,
  type WorkspaceSession,
  type WorkspaceSessionResult,
} from '../core/messages';
import { createConversationThreadStore } from '../core/conversation-thread';
import { createRecaptureDiagnosticsLog } from '../core/recapture-diagnostics';
import { createRecaptureDiagnosticsReport } from '../core/recapture-diagnostics-view';
import { findPlausibleTabCandidates, isPlausibleSessionTab, type PlausibleTabCandidate } from '../core/tab-disambiguation';
import { createWorkspaceSessionStore } from '../core/workspace-session';
import type { GenerationMode, Tone } from '../core/types';
import {
  DESKTOP_EXTENSION_DIAGNOSTICS_BRIDGE_PROTOCOL,
  createRecaptureDiagnosticsBridgeFailure,
} from '../../../shared/recapture-diagnostics-contract';

interface LiveGenerationStreamHandle {
  sessionId: string;
  abortController: AbortController;
}

type InsertionTabResolution =
  | { status: 'resolved'; tab: Browser.tabs.Tab }
  | { status: 'ambiguous'; candidates: PlausibleTabCandidate[] }
  | { status: 'missing' };

const sessions = createWorkspaceSessionStore();
const threads = createConversationThreadStore();
const recaptureDiagnostics = createRecaptureDiagnosticsLog();
const liveGenerationStreamsByRunId = new Map<string, LiveGenerationStreamHandle>();
const GENERATION_RUN_STALE_AFTER_SECONDS = 30;

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: DraftletMessage, sender) => {
    if (message.type === LAUNCH_SIDE_PANEL) {
      return handleLaunchSidePanel(message.context, sender);
    }

    if (message.type === GET_CURRENT_WORKSPACE_SESSION) {
      return handleGetCurrentWorkspaceSession(message.tabId);
    }

    if (message.type === GET_RUNTIME_STATUS) {
      return handleGetRuntimeStatus();
    }

    if (message.type === GET_DOMAIN_HISTORY) {
      return handleGetDomainHistory(message.limit);
    }

    if (message.type === GET_RECAPTURE_DIAGNOSTICS) {
      return handleGetRecaptureDiagnostics(message.sessionId, message.limit);
    }

    if (message.type === PUBLISH_RECAPTURE_DIAGNOSTICS_REPORT) {
      return handlePublishRecaptureDiagnosticsReport(message.sessionId, message.limit);
    }

    if (message.type === RESTORE_DOMAIN_THREAD) {
      return handleRestoreDomainThread(message.sessionId, message.threadId);
    }

    if (message.type === START_DRAFT_GENERATION) {
      return Promise.resolve(handleStartDraftGeneration(message.sessionId, {
        tone: message.tone,
        activeView: message.activeView,
      }));
    }

    if (message.type === START_DRAFT_REFINEMENT) {
      return Promise.resolve(handleStartDraftGeneration(message.sessionId, {
        tone: message.tone,
        activeView: message.activeView,
        instruction: message.instruction,
        mode: 'refinement',
      }));
    }

    if (message.type === CANCEL_DRAFT_GENERATION) {
      return handleCancelDraftGeneration(message.sessionId, message.generationId);
    }

  if (message.type === INSERT_REPLY) {
      return handleInsertReply(message.replyText, message.sessionId);
    }

    if (message.type === GET_INSERTION_TARGET_STATUS) {
      return handleGetInsertionTargetStatus(message.sessionId);
    }

    if (message.type === RECAPTURE_INSERTION_TARGET) {
      return handleRecaptureInsertionTarget(message.sessionId, message.tabId);
    }

    if (message.type === ACTIVATE_RECAPTURE_TAB) {
      return handleActivateRecaptureTab(message.sessionId, message.tabId);
    }

    if (message.type === SET_CURRENT_DRAFT_VARIANT) {
      return Promise.resolve(handleDraftVariantState(message.sessionId, message.variantId, { isCurrent: true }));
    }

    if (message.type === ACCEPT_DRAFT_VARIANT) {
      return Promise.resolve(handleDraftVariantState(message.sessionId, message.variantId, { status: 'accepted' }));
    }

    return undefined;
  });
});

async function handleLaunchSidePanel(
  context: DraftletSidePanelContext,
  sender: Browser.runtime.MessageSender,
): Promise<LaunchSidePanelResult> {
  const tabId = sender.tab?.id ?? context.tabId;

  if (typeof tabId !== 'number') {
    return {
      opened: false,
      message: 'No active tab for Draftlet session.',
    };
  }

  const previousSession = sessions.getByTabId(tabId);
  let session = sessions.upsertFromPageContext({
    context,
    tabId,
    windowId: sender.tab?.windowId ?? context.windowId,
  });

  const previousGenerationId = previousSession?.activeRunId;
  if (previousSession && previousGenerationId) {
    void handleCancelDraftGeneration(previousSession.sessionId, previousGenerationId);
    session = sessions.getBySessionId(session.sessionId) ?? session;
  }

  void persistWorkspaceSession(session).then((persisted) => {
    if (persisted) {
      emitWorkspaceSessionUpdated(persisted);
    }
  });

  try {
    await openSidePanel(session);
    void emitWorkspaceSessionUpdated(session);

    return { opened: true, session };
  } catch (error) {
    return {
      opened: false,
      session,
      message: error instanceof Error ? error.message : 'Could not open side panel.',
    };
  }
}

async function handleGetCurrentWorkspaceSession(tabId?: number): Promise<WorkspaceSessionResult> {
  const resolvedTabId = tabId ?? await getActiveTabId();

  if (typeof resolvedTabId !== 'number') {
    return { session: null };
  }

  const session = sessions.getByTabId(resolvedTabId);

  if (!session) {
    return { session: null };
  }

  const restored = await restoreRuntimeSnapshot(session);
  return {
    session: restored.session,
    thread: restored.thread,
  };
}

async function handleGetRuntimeStatus(): Promise<RuntimeStatusResult> {
  const connected = await checkServerHealth();
  return { status: connected ? 'connected' : 'disconnected' };
}

async function handleGetDomainHistory(limit = 20): Promise<DomainHistoryResult> {
  try {
    return { items: await getDomainHistory(limit) };
  } catch (error) {
    return {
      items: [],
      error: createDraftletError(
        'domain_history_unavailable',
        error instanceof Error ? error.message : 'Could not load Draftlet history.',
        true,
      ),
    };
  }
}

function handleGetRecaptureDiagnostics(sessionId?: string, limit = 50): RecaptureDiagnosticsResult {
  return {
    entries: recaptureDiagnostics.list({ sessionId, limit }),
  };
}

async function handlePublishRecaptureDiagnosticsReport(
  sessionId?: string,
  limit = 50,
): Promise<PublishRecaptureDiagnosticsReportResult> {
  try {
    const report = createRecaptureDiagnosticsReport(recaptureDiagnostics.list({ sessionId, limit }));
    const published = await publishBrowserRecaptureDiagnosticsReport(report);

    return {
      ok: true,
      protocol: DESKTOP_EXTENSION_DIAGNOSTICS_BRIDGE_PROTOCOL,
      report: published,
    };
  } catch (error) {
    return createRecaptureDiagnosticsBridgeFailure(
      'diagnostics_unavailable',
      error instanceof Error ? error.message : 'Could not publish browser recapture diagnostics.',
      true,
    );
  }
}

async function handleRestoreDomainThread(sessionId: string, threadId: string): Promise<RestoreDomainThreadResult> {
  try {
    const [sessionSnapshot, threadSnapshot] = await Promise.all([
      getWorkspaceSessionSnapshot(sessionId),
      getConversationThreadSnapshot(threadId),
    ]);

    if (!sessionSnapshot?.session || !threadSnapshot) {
      return {
        restored: false,
        error: createDraftletError('domain_thread_not_found', 'Draftlet thread was not found in history.', true, threadId),
      };
    }

    const previous = sessions.getBySessionId(sessionId);
    const activeTurn = latestGenerationTurn(threadSnapshot);
    const restoredSession: WorkspaceSession = {
      ...sessionSnapshot.session,
      tabId: previous?.tabId ?? sessionSnapshot.session.tabId,
      windowId: previous?.windowId ?? sessionSnapshot.session.windowId,
      insertionTargetStatus: 'stale',
      activeThreadId: threadId,
      activeTurnId: activeTurn?.turnId ?? sessionSnapshot.session.activeTurnId,
      activeRunId: undefined,
      latestContext: {
        selectedText: threadSnapshot.thread.source.selectedText,
        sourceUrl: threadSnapshot.thread.source.sourceUrl,
        sourceDomain: threadSnapshot.thread.source.sourceDomain,
        pageTitle: threadSnapshot.thread.source.pageTitle,
        tabId: previous?.tabId ?? sessionSnapshot.session.tabId,
        windowId: previous?.windowId ?? sessionSnapshot.session.windowId,
        tone: previous?.latestContext.tone ?? sessionSnapshot.session.latestContext.tone,
        activeView: 'replies',
        composeTarget: previous?.insertionTarget ?? sessionSnapshot.session.insertionTarget,
      },
    };
    sessions.hydrateSession(restoredSession);
    threads.hydrateSnapshot(threadSnapshot);
    void persistWorkspaceSession(restoredSession);
    void emitWorkspaceSessionUpdated(restoredSession);
    void emitConversationThreadUpdated(restoredSession.sessionId, threadSnapshot);

    return {
      restored: true,
      session: restoredSession,
      thread: threadSnapshot,
    };
  } catch (error) {
    return {
      restored: false,
      error: createDraftletError(
        'domain_thread_restore_failed',
        error instanceof Error ? error.message : 'Could not restore this Draftlet thread.',
        true,
        threadId,
      ),
    };
  }
}

async function handleStartDraftGeneration(
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
  liveGenerationStreamsByRunId.set(generationId, { sessionId, abortController });
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

async function handleCancelDraftGeneration(sessionId?: string, generationId?: string): Promise<CancelDraftGenerationResult> {
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
    abortLiveGenerationStream(runId);
  }

  if (runId && turnId) {
    await cancelReplyGenerationRunExecution(runId)
      .catch(() => finalizeGenerationRunStatus(runId, turnId, 'cancelled', error));
    await finalizeGenerationRunStatus(runId, turnId, 'cancelled', error);
    stopLiveGenerationStream(runId);
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

async function runDraftGeneration(
  sessionId: string,
  context: DraftletSidePanelContext,
  generationId: string,
  mode: GenerationMode,
  thread: ConversationThread,
  turn: Turn,
  signal: AbortSignal,
): Promise<void> {
  await Promise.resolve();

  if (!isLiveGenerationStream(sessionId, generationId)) {
    return;
  }

  await finalizeGenerationRunStatus(generationId, turn.turnId, 'streaming');
  const streamingSession = await hydrateWorkspaceSessionFromRuntime(sessionId, sessions.getBySessionId(sessionId) ?? undefined);
  const streamingSnapshot = await hydrateAndEmitThreadSnapshot(sessionId, thread.threadId)
    ?? threads.updateTurnStatus(turn.turnId, 'streaming');
  const streamingTurn = streamingSnapshot ? findTurn(streamingSnapshot, turn.turnId) : null;

  if (streamingSession) {
    void emitWorkspaceSessionUpdated(streamingSession);
  }

  if (streamingSnapshot) {
    void emitConversationThreadUpdated(sessionId, streamingSnapshot);
  }

  await emitDraftletMessage({
    type: DRAFT_GENERATION_STARTED,
    sessionId,
    generationId,
    thread: streamingSnapshot?.thread ?? thread,
    turn: streamingTurn ?? { ...turn, generationStatus: 'streaming' },
  });

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

    await streamReplies(
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
      {
        signal,
        onReply(reply) {
          if (!isLiveGenerationStream(sessionId, generationId)) {
            return;
          }

          void hydrateAndEmitThreadSnapshot(sessionId, thread.threadId).then((runtimeSnapshot) => {
            if (runtimeSnapshot || !isLiveGenerationStream(sessionId, generationId)) {
              return;
            }

            const variantResult = threads.addVariant({
              turnId: turn.turnId,
              tone: context.tone ?? DEFAULT_TONE,
              content: reply.text,
              variantId: reply.variantId,
            });

            if (variantResult) {
              void emitConversationThreadUpdated(sessionId, variantResult.snapshot);
            }
          });
        },
      },
    );

    if (!isLiveGenerationStream(sessionId, generationId)) {
      return;
    }

    await finalizeGenerationRunStatus(generationId, turn.turnId, 'completed');
    const completedSnapshot = await hydrateAndEmitThreadSnapshot(sessionId, thread.threadId)
      ?? threads.updateTurnStatus(turn.turnId, 'completed');
    const completedTurn = completedSnapshot ? findTurn(completedSnapshot, turn.turnId) : null;
    const completedVariants = completedSnapshot ? findVariantsForTurn(completedSnapshot, turn.turnId) : [];

    if (completedSnapshot) {
      void emitConversationThreadUpdated(sessionId, completedSnapshot);
    }

    await emitDraftletMessage({
      type: DRAFT_GENERATION_COMPLETED,
      sessionId,
      generationId,
      thread: completedSnapshot?.thread ?? thread,
      turn: completedTurn ?? { ...turn, generationStatus: 'completed' },
      variants: completedVariants,
    });

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
    if (isLiveGenerationStream(sessionId, generationId)) {
      stopLiveGenerationStream(generationId);
      const updatedSession = await hydrateWorkspaceSessionFromRuntime(sessionId, sessions.getBySessionId(sessionId) ?? undefined)
        ?? sessions.clearActiveRun(sessionId, generationId);

      if (updatedSession) {
        void emitWorkspaceSessionUpdated(updatedSession);
      }
    }
  }
}

async function emitGenerationFailed(
  sessionId: string,
  generationId: string,
  threadId: string,
  turnId: string,
  error: DraftletError,
): Promise<void> {
  if (!isLiveGenerationStream(sessionId, generationId)) {
    return;
  }

  const failedSnapshot = threads.updateTurnStatus(turnId, 'failed', { code: error.code, message: error.message });

  await finalizeGenerationRunStatus(generationId, turnId, 'failed', { code: error.code, message: error.message });
  const runtimeFailedSnapshot = await hydrateAndEmitThreadSnapshot(sessionId, threadId);

  if (!runtimeFailedSnapshot && failedSnapshot) {
    void emitConversationThreadUpdated(sessionId, failedSnapshot);
  }

  await emitDraftletMessage({
    type: DRAFT_GENERATION_FAILED,
    sessionId,
    generationId,
    threadId,
    turnId,
    error,
  });
}

async function handleDraftVariantState(
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

async function handleInsertReply(replyText: string, sessionId?: string): Promise<InsertReplyResult> {
  const session = await resolveInsertionSession(sessionId);

  if (!session) {
    return { result: { status: 'failed', message: 'No active Draftlet tab.', targetStatus: 'unavailable', errorCode: 'session_not_found' } };
  }

  const targetStatus = await revalidateInsertionTarget(session);

  if (targetStatus.status !== 'live') {
    return {
      result: {
        status: 'failed',
        message: targetStatus.message ?? 'Insertion target is not available.',
        targetStatus: targetStatus.status,
        errorCode: `target_${targetStatus.status}`,
      },
    };
  }

  return browser.tabs.sendMessage(session.tabId, {
    type: INSERT_REPLY,
    sessionId: session.sessionId,
    replyText,
    target: targetStatus.target,
  } satisfies DraftletMessage) as Promise<InsertReplyResult>;
}

async function handleGetInsertionTargetStatus(sessionId?: string): Promise<InsertionTargetStatusResult> {
  const session = await resolveInsertionSession(sessionId);

  if (!session) {
    return { status: 'unavailable', message: 'No active Draftlet session.' };
  }

  return revalidateInsertionTarget(session);
}

async function handleRecaptureInsertionTarget(sessionId: string, tabId?: number): Promise<RecaptureInsertionTargetResult> {
  const session = sessions.getBySessionId(sessionId);

  if (!session) {
    return {
      recaptured: false,
      status: 'unavailable',
      outcome: 'recapture_failed',
      reason: 'session_not_found',
      message: 'No active Draftlet session.',
    };
  }

  recordRecaptureDiagnostic({
    event: 'recapture_requested',
    level: 'info',
    sessionId,
    tabId,
    message: tabId ? 'Recapture requested for selected tab.' : 'Recapture requested.',
  });

  const tabResolution = await resolveRecaptureTab(session, tabId);

  if (tabResolution.status === 'ambiguous') {
    const updated = sessions.updatePlausibleTabs(session.sessionId, tabResolution.candidates);

    if (updated) {
      void emitWorkspaceSessionUpdated(updated);
    }

    recordRecaptureDiagnostic({
      event: 'tab_resolution_ambiguous',
      level: 'warning',
      sessionId,
      status: 'tab_disambiguation_required',
      reason: 'tab_disambiguation_required',
      message: `Recapture found ${tabResolution.candidates.length} plausible tabs.`,
    });

    return {
      recaptured: false,
      status: 'tab_disambiguation_required',
      outcome: 'recapture_failed',
      target: session.insertionTarget,
      candidates: tabResolution.candidates,
      reason: 'tab_disambiguation_required',
      message: 'Choose the tab with the compose field before recapturing.',
    };
  }

  const recaptureTabId = tabResolution.status === 'resolved' ? tabResolution.tab.id : undefined;
  const selectedTab = tabResolution.status === 'resolved'
    ? findPlausibleTabCandidates([tabResolution.tab], session)[0]
    : undefined;

  if (tabResolution.status === 'missing' || typeof recaptureTabId !== 'number') {
    const updated = sessions.updateInsertionTarget(session.sessionId, session.insertionTarget, 'unavailable');

    if (updated) {
      void emitWorkspaceSessionUpdated(updated);
    }

    recordRecaptureDiagnostic({
      event: 'tab_resolution_missing',
      level: 'warning',
      sessionId,
      tabId,
      status: 'unavailable',
      reason: 'tab_unavailable',
      message: tabId ? 'Selected recapture tab is unavailable.' : 'No plausible recapture tab is available.',
    });

    return {
      recaptured: false,
      status: 'unavailable',
      outcome: 'chosen_tab_unavailable',
      target: session.insertionTarget,
      reason: 'tab_unavailable',
      message: tabId
        ? 'That tab is no longer available. Choose another tab or use Copy.'
        : 'Open the page with the compose field, focus it, and try again.',
    };
  }

  const target = session.insertionTarget ?? session.latestContext.composeTarget;

  try {
    recordRecaptureDiagnostic({
      event: 'content_recapture_requested',
      level: 'debug',
      sessionId,
      tabId: recaptureTabId,
      message: 'Sent recapture request to content script.',
    });
    const result = await browser.tabs.sendMessage(recaptureTabId, {
      type: RECAPTURE_INSERTION_TARGET,
      sessionId,
      target,
    } satisfies DraftletMessage) as RecaptureInsertionTargetResult;
    const normalizedResult = normalizeRecaptureResult(result, selectedTab, Boolean(tabId));
    recordRecaptureDiagnostic({
      event: 'content_recapture_completed',
      level: normalizedResult.recaptured ? 'info' : normalizedResult.status === 'needs_focus' ? 'warning' : 'error',
      sessionId,
      tabId: recaptureTabId,
      status: normalizedResult.status,
      outcome: normalizedResult.outcome,
      reason: normalizedResult.reason,
      message: normalizedResult.message,
    });
    const updated = sessions.updateInsertionTarget(
      session.sessionId,
      normalizedResult.target ?? target,
      normalizedResult.status,
    );

    if (updated) {
      void emitWorkspaceSessionUpdated(updated);
      if (normalizedResult.recaptured) {
        void persistWorkspaceSession(updated);
      }
    }

    return normalizedResult;
  } catch {
    const updated = sessions.updateInsertionTarget(session.sessionId, session.insertionTarget, 'unavailable');

    if (updated) {
      void emitWorkspaceSessionUpdated(updated);
    }

    recordRecaptureDiagnostic({
      event: 'content_recapture_failed',
      level: 'error',
      sessionId,
      tabId: recaptureTabId,
      status: 'unavailable',
      outcome: 'recapture_failed',
      reason: 'content_script_unavailable',
      message: 'Content script was unavailable during recapture.',
    });

    return {
      recaptured: false,
      status: 'unavailable',
      outcome: 'recapture_failed',
      target: session.insertionTarget,
      selectedTab,
      reason: 'content_script_unavailable',
      message: 'Draftlet cannot reach the page. Reload the page, focus a compose field, and try again.',
    };
  }
}

function normalizeRecaptureResult(
  result: RecaptureInsertionTargetResult,
  selectedTab: PlausibleTabCandidate | undefined,
  fromTabChoice: boolean,
): RecaptureInsertionTargetResult {
  if (result.recaptured) {
    return {
      ...result,
      outcome: 'recapture_succeeded',
      selectedTab,
      message: 'Recaptured the compose field. Insertion is available again.',
    };
  }

  if (result.reason === 'no_focused_compose_target' || result.status === 'needs_focus') {
    return {
      ...result,
      status: 'needs_focus',
      outcome: 'needs_focused_compose_target',
      selectedTab,
      message: fromTabChoice
        ? 'Tab selected. Focus the compose field in that tab, then retry recapture.'
        : 'Focus a compose field on the page, then retry recapture.',
    };
  }

  if (result.status === 'stale') {
    return {
      ...result,
      outcome: fromTabChoice ? 'tab_choice_acknowledged' : 'recapture_failed',
      selectedTab,
      message: fromTabChoice
        ? 'Tab selected, but the saved compose field is stale. Focus the compose field, then retry recapture.'
        : result.message,
    };
  }

  return {
    ...result,
    outcome: result.outcome ?? 'recapture_failed',
    selectedTab,
  };
}

async function handleActivateRecaptureTab(sessionId: string, tabId: number): Promise<ActivateRecaptureTabResult> {
  const session = sessions.getBySessionId(sessionId);

  if (!session) {
    return {
      activated: false,
      error: createDraftletError('session_not_found', 'No active Draftlet session.', true, sessionId),
      message: 'No active Draftlet session.',
    };
  }

  recordRecaptureDiagnostic({
    event: 'tab_activation_requested',
    level: 'info',
    sessionId,
    tabId,
    message: 'Tab activation requested for recapture.',
  });

  const tab = await browser.tabs.get(tabId).catch(() => null);

  if (!tab?.id || !isPlausibleSessionTab(tab, session)) {
    recordRecaptureDiagnostic({
      event: 'tab_activation_failed',
      level: 'warning',
      sessionId,
      tabId,
      reason: 'tab_unavailable',
      message: 'Selected tab is unavailable or no longer plausible for recapture.',
    });

    return {
      activated: false,
      error: createDraftletError('tab_unavailable', 'That tab is no longer available for recapture.', true, sessionId),
      message: 'That tab is no longer available. Choose another tab or use Copy.',
    };
  }

  try {
    if (typeof tab.windowId === 'number') {
      await browser.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
    }

    const activatedTab = await browser.tabs.update(tab.id, { active: true });
    const reboundTab = bindSessionToTab(session, activatedTab?.id ? activatedTab : tab);
    const candidate = findPlausibleTabCandidates([reboundTab], session)[0];

    recordRecaptureDiagnostic({
      event: 'tab_activation_completed',
      level: 'info',
      sessionId,
      tabId: tab.id,
      message: 'Selected tab activated for recapture.',
    });

    return {
      activated: true,
      tab: candidate,
      message: 'Selected tab opened. Focus the compose field there, then retry recapture.',
    };
  } catch {
    recordRecaptureDiagnostic({
      event: 'tab_activation_failed',
      level: 'error',
      sessionId,
      tabId,
      reason: 'tab_activation_failed',
      message: 'Browser rejected selected tab activation.',
    });

    return {
      activated: false,
      error: createDraftletError('tab_activation_failed', 'Draftlet could not open the selected tab.', true, sessionId),
      message: 'Draftlet could not open the selected tab. Switch to it manually, focus the compose field, then retry.',
    };
  }
}

async function revalidateInsertionTarget(session: WorkspaceSession): Promise<InsertionTargetStatusResult> {
  const tabResolution = await resolveInsertionTab(session);

  if (tabResolution.status === 'ambiguous') {
    const updated = sessions.updatePlausibleTabs(session.sessionId, tabResolution.candidates);

    if (updated) {
      void emitWorkspaceSessionUpdated(updated);
    }

    return {
      status: 'tab_disambiguation_required',
      target: session.insertionTarget,
      candidates: tabResolution.candidates,
      message: 'Choose the tab with the compose field before recapturing.',
    };
  }

  const revalidationTabId = tabResolution.status === 'resolved' ? tabResolution.tab.id : undefined;

  if (tabResolution.status === 'missing' || typeof revalidationTabId !== 'number') {
    const updated = sessions.updateInsertionTarget(session.sessionId, session.insertionTarget, 'unavailable');

    if (updated) {
      void emitWorkspaceSessionUpdated(updated);
    }

    return { status: 'unavailable', target: session.insertionTarget, message: 'Original page is not open.' };
  }

  const target = session.insertionTarget ?? session.latestContext.composeTarget;

  try {
    const result = await browser.tabs.sendMessage(revalidationTabId, {
      type: REVALIDATE_INSERTION_TARGET,
      sessionId: session.sessionId,
      target,
    } satisfies DraftletMessage) as InsertionTargetStatusResult;
    const updated = sessions.updateInsertionTarget(
      session.sessionId,
      result.target ?? target,
      result.status,
    );

    if (updated) {
      void emitWorkspaceSessionUpdated(updated);
      if (result.status === 'live') {
        void persistWorkspaceSession(updated);
      }
    }

    return result;
  } catch {
    const updated = sessions.updateInsertionTarget(session.sessionId, target, 'unavailable');

    if (updated) {
      void emitWorkspaceSessionUpdated(updated);
    }

    return { status: 'unavailable', target, message: 'Draftlet cannot reach the page for insertion.' };
  }
}

async function resolveRecaptureTab(session: WorkspaceSession, tabId?: number): Promise<InsertionTabResolution> {
  if (typeof tabId === 'number') {
    const tab = await browser.tabs.get(tabId).catch(() => null);

    if (tab?.id && isPlausibleSessionTab(tab, session)) {
      return { status: 'resolved', tab: bindSessionToTab(session, tab) };
    }

    return { status: 'missing' };
  }

  const activeTab = await getActiveTab().catch(() => null);

  if (activeTab?.id && isPlausibleSessionTab(activeTab, session)) {
    return { status: 'resolved', tab: bindSessionToTab(session, activeTab) };
  }

  return resolveInsertionTab(session);
}

async function resolveInsertionTab(session: WorkspaceSession): Promise<InsertionTabResolution> {
  const shouldDisambiguate = session.insertionTargetStatus === 'stale'
    || session.insertionTargetStatus === 'tab_disambiguation_required';

  if (!shouldDisambiguate && session.tabId >= 0) {
    const tab = await browser.tabs.get(session.tabId).catch(() => null);

    if (tab && isPlausibleSessionTab(tab, session)) {
      return { status: 'resolved', tab };
    }
  }

  const tabs = await browser.tabs.query({}).catch(() => []);
  const candidates = findPlausibleTabCandidates(tabs, session);

  if (candidates.length > 1) {
    return { status: 'ambiguous', candidates };
  }

  const candidate = candidates[0];

  if (!candidate) {
    return { status: 'missing' };
  }

  const tab = tabs.find((item) => item.id === candidate.tabId);

  if (!tab?.id) {
    return { status: 'missing' };
  }

  return { status: 'resolved', tab: bindSessionToTab(session, tab) };
}

function bindSessionToTab(session: WorkspaceSession, tab: Browser.tabs.Tab): Browser.tabs.Tab {
  if (!tab.id) {
    return tab;
  }

  const updated = sessions.hydrateSession({
    ...session,
    tabId: tab.id,
    windowId: tab.windowId,
    plausibleTabs: undefined,
    latestContext: {
      ...session.latestContext,
      tabId: tab.id,
      windowId: tab.windowId,
    },
  });
  void emitWorkspaceSessionUpdated(updated);
  return tab;
}

async function resolveInsertionSession(sessionId?: string): Promise<WorkspaceSession | null> {
  if (sessionId) {
    return sessions.getBySessionId(sessionId);
  }

  const tabId = await getActiveTabId();
  return typeof tabId === 'number' ? sessions.getByTabId(tabId) : null;
}

function resolveGenerationSession(sessionId?: string, generationId?: string): WorkspaceSession | null {
  if (sessionId) {
    return sessions.getBySessionId(sessionId);
  }

  if (generationId) {
    return sessions.findByActiveRunId(generationId);
  }

  return null;
}

async function ensureThreadSnapshotForGeneration(
  session: WorkspaceSession,
  context: DraftletSidePanelContext,
  mode: GenerationMode,
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

async function restoreRuntimeSnapshot(session: WorkspaceSession): Promise<WorkspaceSessionResult> {
  try {
    const snapshot = await getWorkspaceSessionSnapshot(session.sessionId);

    if (!snapshot) {
      return { session };
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

    const restoredThread = snapshot.thread
      ? await reconcileInterruptedGeneration(restoredSession.sessionId, snapshot.thread)
      : null;

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

    sessions.hydrateSession(restoredSession);

    if (restoredThread) {
      threads.hydrateSnapshot(restoredThread);
      void emitConversationThreadUpdated(restoredSession.sessionId, restoredThread);
    }

    return { session: restoredSession, thread: restoredThread };
  } catch {
    return { session };
  }
}

async function reconcileInterruptedGeneration(sessionId: string, snapshot: ConversationThreadSnapshot): Promise<ConversationThreadSnapshot> {
  if (hasLiveGenerationStreamForSession(sessionId)) {
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

async function finalizeGenerationRunStatus(
  runId: string | undefined,
  turnId: string,
  status: 'streaming' | 'completed' | 'failed' | 'cancelled' | 'interrupted',
  error?: { code?: string; message?: string },
): Promise<void> {
  if (runId) {
    try {
      await patchGenerationRunStatus(runId, status, error);
      return;
    } catch {
      // Fall back to the durable Turn lifecycle for transitional compatibility.
    }
  }

  const turnStatus = status === 'interrupted' ? 'failed' : status;
  await patchTurnStatus(turnId, turnStatus, error).catch(() => null);
}

async function getLiveRuntimeGenerationConflict(sessionId: string) {
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

  return executionState?.live[0] ?? null;
}

function abortLiveGenerationStream(runId: string): void {
  liveGenerationStreamsByRunId.get(runId)?.abortController.abort();
}

function stopLiveGenerationStream(runId: string): void {
  liveGenerationStreamsByRunId.delete(runId);
}

function hasLiveGenerationStreamForSession(sessionId: string): boolean {
  for (const stream of liveGenerationStreamsByRunId.values()) {
    if (stream.sessionId === sessionId) {
      return true;
    }
  }

  return false;
}

async function hydrateWorkspaceSessionFromRuntime(
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

async function hydrateAndEmitThreadSnapshot(
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

async function getRestorableThreadSnapshot(session: WorkspaceSession): Promise<ConversationThreadSnapshot | null> {
  if (session.activeThreadId) {
    return threads.getSnapshot(session.activeThreadId)
      ?? await getConversationThreadSnapshot(session.activeThreadId).catch(() => null);
  }

  return threads.getSnapshotForSession(session.sessionId);
}

function latestGenerationTurn(snapshot: ConversationThreadSnapshot): Turn | null {
  return [...snapshot.turns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).at(0) ?? null;
}

function isInProgressTurn(turn: Turn): boolean {
  return turn.generationStatus === 'queued' || turn.generationStatus === 'started' || turn.generationStatus === 'streaming';
}

async function persistWorkspaceSession(session: WorkspaceSession): Promise<WorkspaceSession | null> {
  try {
    return await putWorkspaceSession(session);
  } catch {
    return null;
  }
}

async function openSidePanel(session: WorkspaceSession) {
  if (!browser.sidePanel?.open) {
    throw new Error('Chrome side panel is not available.');
  }

  await browser.sidePanel.open({ tabId: session.tabId });
}

async function getActiveTabId(): Promise<number | undefined> {
  const tab = await getActiveTab();
  return tab?.id;
}

async function getActiveTab(): Promise<Browser.tabs.Tab | undefined> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab;
  } catch {
    return undefined;
  }
}

function isLiveGenerationStream(sessionId: string, runId: string): boolean {
  return liveGenerationStreamsByRunId.get(runId)?.sessionId === sessionId;
}

function emitWorkspaceSessionUpdated(session: WorkspaceSession): Promise<unknown> {
  return emitDraftletMessage({
    type: WORKSPACE_SESSION_UPDATED,
    session,
  });
}

function emitConversationThreadUpdated(sessionId: string, snapshot: ConversationThreadSnapshot): Promise<unknown> {
  return emitDraftletMessage({
    type: CONVERSATION_THREAD_UPDATED,
    sessionId,
    snapshot,
  });
}

function emitDraftletMessage(message: DraftletMessage): Promise<unknown> {
  return browser.runtime.sendMessage(message).catch(() => {});
}

function recordRecaptureDiagnostic(input: Omit<RecaptureDiagnosticEntry, 'id' | 'at'>): RecaptureDiagnosticEntry {
  const entry = recaptureDiagnostics.append(input);
  console.debug('[Draftlet recapture]', {
    id: entry.id,
    event: entry.event,
    level: entry.level,
    sessionId: entry.sessionId,
    tabId: entry.tabId,
    status: entry.status,
    outcome: entry.outcome,
    reason: entry.reason,
    message: entry.message,
    at: entry.at,
  });
  return entry;
}

function findTurn(snapshot: ConversationThreadSnapshot, turnId: string): Turn | null {
  return snapshot.turns.find((turn) => turn.turnId === turnId) ?? null;
}

function findVariantsForTurn(snapshot: ConversationThreadSnapshot, turnId: string) {
  return snapshot.variants.filter((variant) => variant.turnId === turnId);
}

function normalizeInstruction(instruction: string | undefined, mode: GenerationMode): string | undefined {
  const trimmed = instruction?.trim();

  if (trimmed) {
    return trimmed;
  }

  return mode === 'initial' ? 'Generate reply drafts' : undefined;
}

function createDraftletError(
  code: string,
  message: string,
  retryable: boolean,
  correlationId?: string,
): DraftletError {
  return {
    code,
    message,
    retryable,
    correlationId,
  };
}

function createGenerationId(): string {
  return createDomainId('generation');
}

function createDomainId(prefix: string): string {
  if (typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
