import {
  ACCEPT_DRAFT_VARIANT,
  CANCEL_DRAFT_GENERATION,
  CONVERSATION_THREAD_UPDATED,
  GET_CURRENT_WORKSPACE_SESSION,
  GET_DOMAIN_HISTORY,
  GET_INSERTION_TARGET_STATUS,
  GET_RUNTIME_STATUS,
  INSERT_REPLY,
  INSERTION_IN_PROGRESS,
  RESTORE_DOMAIN_THREAD,
  SET_CURRENT_DRAFT_VARIANT,
  START_DRAFT_GENERATION,
  START_DRAFT_REFINEMENT,
  WORKSPACE_SESSION_UPDATED,
  type ConversationThreadSnapshot,
  type DomainHistoryItem,
  type DomainHistoryResult,
  type DraftletMessage,
  type DraftVariantStateResult,
  type InsertReplyResult,
  type InsertionTargetStatusResult,
  type RestoreDomainThreadResult,
  type RuntimeStatusResult,
  type StartDraftGenerationResult,
  type WorkspaceRestoreState,
  type WorkspaceSession,
  type WorkspaceSessionResult,
} from '../../core/messages';
import { buildWorkspaceRestoreState } from '../../core/restore-conflict';
import type { InsertionResult, InsertionTargetStatus, PanelView, Tone } from '../../core/types';
import {
  type SidePanelState,
  shouldApplySessionUpdate,
} from './state';
import type { PanelController } from '../mount-panel';
import type { SendMessage } from './runtime-message-bus';
import {
  appendTrail,
  insertionTargetMessage,
} from '../../components/panel/insertion-status-trail';

export interface SidePanelStorage {
  getSavedTone(): Promise<Tone>;
  getSavedPanelView(): Promise<PanelView>;
  saveTone(tone: Tone): Promise<void>;
  savePanelView(view: PanelView): Promise<void>;
}

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface VariantActionResult {
  ok: boolean;
  message: string;
}

export function setTone(state: SidePanelState, panel: PanelController, storage: SidePanelStorage, tone: Tone): void {
  state.currentTone = tone;
  if (state.currentSession) {
    state.currentSession = {
      ...state.currentSession,
      latestContext: {
        ...state.currentSession.latestContext,
        tone,
      },
    };
  }
  void storage.saveTone(tone);
}

export function setActiveView(state: SidePanelState, panel: PanelController, storage: SidePanelStorage, activeView: PanelView): void {
  state.currentPanelView = activeView;
  if (state.currentSession) {
    state.currentSession = {
      ...state.currentSession,
      latestContext: {
        ...state.currentSession.latestContext,
        activeView,
      },
    };
  }
  void storage.savePanelView(activeView);
}

export function applySession(
  state: SidePanelState,
  panel: PanelController,
  session: WorkspaceSession,
  restoreState?: WorkspaceRestoreState,
): void {
  const previousSession = state.currentSession;
  const tone = session.latestContext.tone ?? state.currentTone;
  const activeView = session.latestContext.activeView ?? state.currentPanelView;
  const shouldOpenSession = !previousSession
    || previousSession.sessionId !== session.sessionId
    || previousSession.pageUrl !== session.pageUrl
    || previousSession.latestContext.selectedText !== session.latestContext.selectedText;

  state.currentSession = {
    ...session,
    latestContext: {
      ...session.latestContext,
      tone,
      activeView,
    },
  };
  state.currentTone = tone;
  state.currentPanelView = activeView;

  if (previousSession?.sessionId !== session.sessionId) {
    state.insertionTrail = [];
    state.currentThreadSnapshot = null;
  }

  if (shouldOpenSession) {
    panel.open({
      selectedText: session.latestContext.selectedText,
      tone,
      activeView,
    });
  }

  panel.setInsertionTargetStatus({
    status: session.insertionTargetStatus ?? (session.insertionTarget ? 'stale' : 'needs_recapture'),
    message: insertionTargetMessage(session),
    candidates: session.plausibleTabs,
    trail: state.insertionTrail,
  });
  panel.setRestoreState(restoreState ?? state.currentSession.restoreState ?? buildCurrentRestoreState(state));

  if (shouldOpenSession) {
    void refreshInsertionTargetStatus(state, panel, sendMessage);
  }
}

export function applyThreadSnapshot(state: SidePanelState, panel: PanelController, snapshot: ConversationThreadSnapshot): void {
  state.currentThreadSnapshot = snapshot;
  panel.setThreadSnapshot(snapshot);
  panel.setRestoreState(buildCurrentRestoreState(state));
  applyPanelStateFromThread(state, panel, snapshot);
}

export function applyPanelStateFromThread(state: SidePanelState, panel: PanelController, snapshot: ConversationThreadSnapshot): void {
  const activeTurn = state.currentSession?.activeTurnId
    ? snapshot.turns.find((turn) => turn.turnId === state.currentSession?.activeTurnId)
    : undefined;
  const latestTurn = activeTurn ?? [...snapshot.turns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).at(0);

  if (!latestTurn) {
    if (state.currentSession?.activeRunId) {
      panel.setState('loading');
    }

    return;
  }

  if (latestTurn.generationStatus === 'queued' || latestTurn.generationStatus === 'started') {
    panel.setState('loading');
    return;
  }

  if (latestTurn.generationStatus === 'streaming') {
    panel.setState('streaming');
    return;
  }

  if (snapshot.latestRecoverableRun?.recoverable && snapshot.latestRecoverableRun.turnId === latestTurn.turnId) {
    panel.setState('error', snapshot.latestRecoverableRun.errorMessage ?? 'Draft generation was interrupted before completion.');
    return;
  }

  if (latestTurn.generationStatus === 'completed') {
    const hasVariants = snapshot.variants.some((variant) => variant.turnId === latestTurn.turnId);
    panel.setState(hasVariants ? 'success' : 'error', hasVariants ? '' : 'No replies returned.');
    return;
  }

  if (latestTurn.generationStatus === 'failed') {
    panel.setState('error', latestTurn.generationErrorMessage ?? 'Could not generate replies.');
    return;
  }

  if (latestTurn.generationStatus === 'cancelled') {
    panel.setState('error', latestTurn.generationErrorMessage ?? 'Draft generation was cancelled.');
  }
}

export function buildCurrentRestoreState(state: SidePanelState): WorkspaceRestoreState | null {
  if (!state.currentSession) {
    return null;
  }

  return buildWorkspaceRestoreState({
    session: state.currentSession,
    thread: state.currentThreadSnapshot,
    source: state.currentSession.restoreState?.source ?? 'session_update',
  });
}

let sendMessage: SendMessage = () => Promise.reject(new Error('sendMessage not initialized'));

export function configureSendMessage(fn: SendMessage): void {
  sendMessage = fn;
}

export async function refreshHealth(state: SidePanelState, panel: PanelController): Promise<boolean> {
  try {
    const response = await sendMessage<RuntimeStatusResult>({
      type: GET_RUNTIME_STATUS,
    } satisfies DraftletMessage);

    panel.setConnectionStatus(response.status);
    return response.status === 'connected';
  } catch {
    panel.setConnectionStatus('disconnected');
    return false;
  }
}

export async function refreshInsertionTargetStatus(state: SidePanelState, panel: PanelController, send: SendMessage): Promise<void> {
  if (!state.currentSession) {
    panel.setInsertionTargetStatus({
      status: 'needs_recapture',
      message: 'Open Draftlet from a compose field to enable insertion.',
      trail: state.insertionTrail,
    });
    return;
  }

  try {
    const response = await send<InsertionTargetStatusResult>({
      type: GET_INSERTION_TARGET_STATUS,
      sessionId: state.currentSession.sessionId,
    } satisfies DraftletMessage);

    panel.setInsertionTargetStatus({
      status: response.status,
      message: response.message,
      candidates: response.candidates,
      trail: state.insertionTrail,
    });
    state.currentSession = {
      ...state.currentSession,
      insertionTarget: response.target ?? state.currentSession.insertionTarget,
      insertionTargetStatus: response.status,
      plausibleTabs: response.candidates,
    };
    panel.setRestoreState(buildCurrentRestoreState(state));
  } catch {
    panel.setInsertionTargetStatus({
      status: 'unavailable',
      message: 'Insertion target is unavailable.',
      trail: state.insertionTrail,
    });
    if (state.currentSession) {
      state.currentSession = {
        ...state.currentSession,
        insertionTargetStatus: 'unavailable',
        plausibleTabs: undefined,
      };
    }
    panel.setRestoreState(buildCurrentRestoreState(state));
  }
}

export async function loadDomainHistory(state: SidePanelState, panel: PanelController): Promise<DomainHistoryItem[]> {
  try {
    const response = await sendMessage<DomainHistoryResult>({
      type: GET_DOMAIN_HISTORY,
      limit: 20,
    } satisfies DraftletMessage);

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.items;
  } catch (error) {
    panel.setConnectionStatus('disconnected');
    throw error;
  }
}

export async function restoreDomainHistoryItem(state: SidePanelState, panel: PanelController, item: DomainHistoryItem): Promise<VariantActionResult> {
  try {
    const response = await sendMessage<RestoreDomainThreadResult>({
      type: RESTORE_DOMAIN_THREAD,
      sessionId: item.session.sessionId,
      threadId: item.thread.thread.threadId,
    } satisfies DraftletMessage);

    if (!response.restored || !response.session || !response.thread) {
      return { ok: false, message: response.error?.message ?? 'Could not restore this thread.' };
    }

    applySession(state, panel, response.session, response.restoreState);
    applyThreadSnapshot(state, panel, response.thread);
    panel.setActiveView('replies');
    return { ok: true, message: 'Restored this thread.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not reach the Draftlet extension coordinator.',
    };
  }
}

export async function startDraftGenerationFromCurrentSession(
  state: SidePanelState,
  panel: PanelController,
  options: { missingContextMessage?: string; startErrorMessage?: string; successMessage?: string } = {},
): Promise<ActionResult> {
  if (!state.currentSession?.latestContext.selectedText) {
    const message = options.missingContextMessage ?? 'Select text on a page before generating replies.';
    panel.setState('error', message);
    return { ok: false, message };
  }

  await cancelActiveGeneration(state);

  panel.setState('loading');

  try {
    const response = await sendMessage<StartDraftGenerationResult>({
      type: START_DRAFT_GENERATION,
      sessionId: state.currentSession.sessionId,
      tone: state.currentTone,
      activeView: state.currentPanelView,
    } satisfies DraftletMessage);

    if (!response.started || !response.generationId || !response.sessionId) {
      const message = response.error?.message ?? options.startErrorMessage ?? 'Could not start draft generation.';
      panel.setState('error', message);
      return { ok: false, message };
    }

    if (state.currentSession) {
      state.currentSession = {
        ...state.currentSession,
        activeThreadId: response.threadId ?? state.currentSession.activeThreadId,
        activeTurnId: response.turnId ?? state.currentSession.activeTurnId,
        activeRunId: response.generationId,
      };
    }
    return { ok: true, message: options.successMessage ?? 'Started draft generation.' };
  } catch (error) {
    panel.setConnectionStatus('disconnected');
    const message = error instanceof Error ? error.message : 'Could not reach the Draftlet extension coordinator.';
    panel.setState('error', message);
    return { ok: false, message };
  }
}

export async function generateReplies(state: SidePanelState, panel: PanelController): Promise<void> {
  const result = await startDraftGenerationFromCurrentSession(state, panel);

  if (!result.ok && result.message) {
    panel.setState('error', result.message);
  }
}

export async function retryInterruptedTurn(state: SidePanelState, panel: PanelController, _turnId: string): Promise<VariantActionResult> {
  const result = await startDraftGenerationFromCurrentSession(state, panel, {
    missingContextMessage: 'Restore the thread context before retrying this draft.',
    startErrorMessage: 'Could not retry this draft generation.',
    successMessage: 'Started a new run from this thread.',
  });
  return { ok: result.ok, message: result.message ?? '' };
}

export async function refineReplies(state: SidePanelState, panel: PanelController, instruction: string): Promise<void> {
  if (!state.currentSession?.latestContext.selectedText) {
    panel.setState('error', 'Select text on a page before refining replies.');
    return;
  }

  const trimmedInstruction = instruction.trim();

  if (!trimmedInstruction) {
    panel.setState('error', 'Add a follow-up instruction before refining drafts.');
    return;
  }

  await cancelActiveGeneration(state);

  panel.setState('loading');

  try {
    const response = await sendMessage<StartDraftGenerationResult>({
      type: START_DRAFT_REFINEMENT,
      sessionId: state.currentSession.sessionId,
      instruction: trimmedInstruction,
      tone: state.currentTone,
      activeView: state.currentPanelView,
    } satisfies DraftletMessage);

    if (!response.started || !response.generationId || !response.sessionId) {
      panel.setState('error', response.error?.message ?? 'Could not start draft refinement.');
      return;
    }

    if (state.currentSession) {
      state.currentSession = {
        ...state.currentSession,
        activeThreadId: response.threadId ?? state.currentSession.activeThreadId,
        activeTurnId: response.turnId ?? state.currentSession.activeTurnId,
        activeRunId: response.generationId,
      };
    }
  } catch (error) {
    panel.setConnectionStatus('disconnected');
    panel.setState(
      'error',
      error instanceof Error ? error.message : 'Could not reach the Draftlet extension coordinator.',
    );
  }
}

export async function setVariantCurrent(state: SidePanelState, panel: PanelController, variantId: string): Promise<VariantActionResult> {
  return updateVariantState(state, panel, variantId, SET_CURRENT_DRAFT_VARIANT, 'Selected this draft.');
}

export async function acceptVariant(state: SidePanelState, panel: PanelController, variantId: string): Promise<VariantActionResult> {
  return updateVariantState(state, panel, variantId, ACCEPT_DRAFT_VARIANT, 'Accepted this draft.');
}

async function updateVariantState(
  state: SidePanelState,
  panel: PanelController,
  variantId: string,
  type: typeof SET_CURRENT_DRAFT_VARIANT | typeof ACCEPT_DRAFT_VARIANT,
  successMessage: string,
): Promise<VariantActionResult> {
  if (!state.currentSession) {
    return { ok: false, message: 'No active Draftlet session.' };
  }

  try {
    const response = await sendMessage<DraftVariantStateResult>({
      type,
      sessionId: state.currentSession.sessionId,
      variantId,
    } satisfies DraftletMessage);

    if (!response.updated || !response.snapshot) {
      return { ok: false, message: response.error?.message ?? 'Could not update this draft.' };
    }

    applyThreadSnapshot(state, panel, response.snapshot);
    return { ok: true, message: successMessage };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not reach the Draftlet extension coordinator.',
    };
  }
}

export async function insertIntoActivePage(
  state: SidePanelState,
  panel: PanelController,
  replyText: string,
  variantId?: string,
): Promise<InsertionResult> {
  state.isInsertInProgress = true;
  state.insertInProgressMessage = 'Click the compose field to insert.';

  try {
    const response = await sendMessage<InsertReplyResult>({
      type: INSERT_REPLY,
      sessionId: state.currentSession?.sessionId,
      replyText,
      variantId,
    } satisfies DraftletMessage);

    return applyInsertionResult(state, panel, response.result, replyText);
  } catch {
    // The background failed to route the request. Fall back to a
    // one-shot clipboard copy; show the corresponding message.
    return fallbackCopy(state, panel, replyText);
  } finally {
    state.isInsertInProgress = false;
    state.insertInProgressMessage = '';
  }
}

function applyInsertionResult(
  state: SidePanelState,
  panel: PanelController,
  result: InsertionResult,
  replyText: string,
): Promise<InsertionResult> | InsertionResult {
  if (result.status === 'inserted') {
    panel.setInsertionTargetStatus({
      status: 'live',
      message: 'Inserted into the focused field.',
      trail: state.insertionTrail,
    });
    if (state.currentSession) {
      state.currentSession = {
        ...state.currentSession,
        insertionTargetStatus: 'live',
        plausibleTabs: undefined,
      };
    }
    panel.setRestoreState(buildCurrentRestoreState(state));
    return result;
  }

  if (result.status === 'copied') {
    panel.setInsertionTargetStatus({
      status: result.targetStatus ?? 'unavailable',
      message: result.message,
      trail: state.insertionTrail,
    });
    if (state.currentSession) {
      state.currentSession = {
        ...state.currentSession,
        insertionTargetStatus: result.targetStatus ?? 'unavailable',
        plausibleTabs: undefined,
      };
    }
    panel.setRestoreState(buildCurrentRestoreState(state));
    return result;
  }

  // status === 'failed'
  if (result.errorCode === 'armed_capture_timeout') {
    return fallbackCopy(state, panel, replyText);
  }

  if (result.targetStatus) {
    panel.setInsertionTargetStatus({
      status: result.targetStatus,
      message: result.message,
      trail: state.insertionTrail,
    });
    if (state.currentSession) {
      state.currentSession = {
        ...state.currentSession,
        insertionTargetStatus: result.targetStatus,
        plausibleTabs: undefined,
      };
    }
    panel.setRestoreState(buildCurrentRestoreState(state));
  }

  return result;
}

async function fallbackCopy(
  state: SidePanelState,
  panel: PanelController,
  replyText: string,
): Promise<InsertionResult> {
  try {
    await navigator.clipboard.writeText(replyText);
    const message = "Couldn't find a compose field, so the draft was copied.";
    state.insertionTrail = appendTrail(
      state.insertionTrail,
      'recapture_failed',
      'failed',
      message,
    );
    panel.setInsertionTargetStatus({
      status: 'unavailable',
      message,
      trail: state.insertionTrail,
    });
    if (state.currentSession) {
      state.currentSession = {
        ...state.currentSession,
        insertionTargetStatus: 'unavailable',
        plausibleTabs: undefined,
      };
    }
    panel.setRestoreState(buildCurrentRestoreState(state));
    return { status: 'copied', message, targetStatus: 'unavailable' };
  } catch {
    const message = "Couldn't find a compose field. Use Copy instead.";
    state.insertionTrail = appendTrail(
      state.insertionTrail,
      'recapture_failed',
      'failed',
      message,
    );
    panel.setInsertionTargetStatus({
      status: 'unavailable',
      message,
      trail: state.insertionTrail,
    });
    if (state.currentSession) {
      state.currentSession = {
        ...state.currentSession,
        insertionTargetStatus: 'unavailable',
        plausibleTabs: undefined,
      };
    }
    panel.setRestoreState(buildCurrentRestoreState(state));
    return { status: 'failed', message, targetStatus: 'unavailable' };
  }
}

export function onInsertionInProgress(state: SidePanelState, panel: PanelController, message: string): void {
  state.isInsertInProgress = true;
  state.insertInProgressMessage = message;

  panel.setInsertionTargetStatus({
    status: 'needs_focus',
    message,
    outcome: 'needs_focused_compose_target',
    trail: state.insertionTrail,
  });
  if (state.currentSession) {
    state.currentSession = {
      ...state.currentSession,
      insertionTargetStatus: 'needs_focus',
    };
  }
  panel.setRestoreState(buildCurrentRestoreState(state));
}

export async function cancelActiveGeneration(state: SidePanelState): Promise<void> {
  const session = state.currentSession;
  const generationId = session?.activeRunId;

  if (!session || !generationId) {
    return;
  }

  state.currentSession = {
    ...session,
    activeRunId: undefined,
  };

  await sendMessage({
    type: CANCEL_DRAFT_GENERATION,
    sessionId: session.sessionId,
    generationId,
  } satisfies DraftletMessage).catch(() => {});
}

export async function closeSidePanel(state: SidePanelState): Promise<void> {
  await cancelActiveGeneration(state);

  try {
    if (browser.sidePanel?.close) {
      const currentWindow = await browser.windows.getCurrent();

      if (currentWindow.id !== undefined) {
        await browser.sidePanel.close({ windowId: currentWindow.id });
        return;
      }
    }
  } catch {
    // Older Chrome versions may not expose sidePanel.close.
  }

  window.close();
}

export async function initializeSidePanel(
  state: SidePanelState,
  panel: PanelController,
  storage: SidePanelStorage,
): Promise<void> {
  const [tone, panelView] = await Promise.all([storage.getSavedTone(), storage.getSavedPanelView()]);
  state.currentTone = tone;
  state.currentPanelView = panelView;
  panel.setTone(tone);
  panel.setActiveView(panelView);

  await refreshHealth(state, panel);

  try {
    const response = await sendMessage<WorkspaceSessionResult>({
      type: GET_CURRENT_WORKSPACE_SESSION,
    } satisfies DraftletMessage);

    if (response.session) {
      applySession(state, panel, response.session, response.restoreState);

      if (response.thread) {
        applyThreadSnapshot(state, panel, response.thread);
      }

      return;
    }
  } catch {
    // The side panel can still show history without page context.
  }

  panel.open({
    selectedText: 'Select text on a page and click Draftlet to begin.',
    tone: state.currentTone,
    activeView: state.currentPanelView,
  });
}

export function onDraftletMessage(state: SidePanelState, panel: PanelController, message: DraftletMessage): void {
  if (message.type === WORKSPACE_SESSION_UPDATED) {
    if (shouldApplySessionUpdate(state, message.session)) {
      applySession(state, panel, message.session);
    }
    return;
  }

  if (message.type === CONVERSATION_THREAD_UPDATED) {
    if (state.currentSession?.sessionId === message.sessionId) {
      applyThreadSnapshot(state, panel, message.snapshot);
    }
    return;
  }

  if (message.type === INSERTION_IN_PROGRESS) {
    if (state.currentSession?.sessionId === message.sessionId) {
      onInsertionInProgress(state, panel, message.message);
    }
    return;
  }
}
