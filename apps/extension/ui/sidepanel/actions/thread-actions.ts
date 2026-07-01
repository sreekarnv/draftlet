import {
  ACCEPT_DRAFT_VARIANT,
  CONVERSATION_THREAD_UPDATED,
  DRAFT_TEXT_DELTA_RECEIVED,
  INSERTION_IN_PROGRESS,
  SET_CURRENT_DRAFT_VARIANT,
  WORKSPACE_SESSION_UPDATED,
  type ConversationThreadSnapshot,
  type DraftletMessage,
  type DraftVariantStateResult,
  type WorkspaceRestoreState,
  type WorkspaceSession,
} from '../../../core/messages';
import type { PanelController } from '../../mount-panel';
import type { SidePanelState } from '../state';
import { shouldApplySessionUpdate } from '../state';
import type { VariantActionResult } from './action-types';
import {
  onInsertionInProgress,
  refreshInsertionTargetStatus,
  setSessionInsertionTargetStatus,
} from './insertion-actions';
import { getSendMessage } from './message-client';
import { buildCurrentRestoreState } from './restore-state';

export { buildCurrentRestoreState } from './restore-state';

export function applySession(
  state: SidePanelState,
  panel: PanelController,
  session: WorkspaceSession,
  restoreState?: WorkspaceRestoreState,
): void {
  const previousSession = state.runtime.currentSession;
  const tone = session.latestContext.tone ?? state.ui.currentTone;
  const activeView = session.latestContext.activeView ?? state.ui.currentPanelView;
  const shouldOpenSession = !previousSession
    || previousSession.sessionId !== session.sessionId
    || previousSession.pageUrl !== session.pageUrl
    || previousSession.latestContext.selectedText !== session.latestContext.selectedText;

  state.runtime.currentSession = session;
  state.ui.currentTone = tone;
  state.ui.currentPanelView = activeView;
  state.ui.selectedThreadId = session.activeThreadId ?? null;

  if (previousSession?.sessionId !== session.sessionId) {
    state.ui.insertionTrail = [];
    state.ui.selectedVariantId = null;
    state.runtime.currentThreadSnapshot = null;
  }

  if (shouldOpenSession) {
    panel.open({
      selectedText: session.latestContext.selectedText,
      tone,
      activeView,
    });
  }

  setSessionInsertionTargetStatus(state, panel);
  panel.setRestoreState(restoreState ?? state.runtime.currentSession.restoreState ?? buildCurrentRestoreState(state));

  if (shouldOpenSession) {
    void refreshInsertionTargetStatus(state, panel, getSendMessage());
  }
}

export function applyThreadSnapshot(state: SidePanelState, panel: PanelController, snapshot: ConversationThreadSnapshot): void {
  state.runtime.currentThreadSnapshot = snapshot;
  state.ui.selectedThreadId = snapshot.thread.threadId;
  state.ui.selectedVariantId = snapshot.variants.find((variant) => variant.isCurrent)?.variantId
    ?? state.ui.selectedVariantId;
  panel.setThreadSnapshot(snapshot);
  panel.setRestoreState(buildCurrentRestoreState(state));
  applyPanelStateFromThread(state, panel, snapshot);
}

export function applyPanelStateFromThread(state: SidePanelState, panel: PanelController, snapshot: ConversationThreadSnapshot): void {
  const activeTurn = state.runtime.currentSession?.activeTurnId
    ? snapshot.turns.find((turn) => turn.turnId === state.runtime.currentSession?.activeTurnId)
    : undefined;
  const latestTurn = activeTurn ?? [...snapshot.turns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).at(0);

  if (!latestTurn) {
    if (state.runtime.currentSession?.activeRunId) {
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
  if (!state.runtime.currentSession) {
    return { ok: false, message: 'No active Draftlet session.' };
  }

  try {
    const response = await getSendMessage()<DraftVariantStateResult>({
      type,
      sessionId: state.runtime.currentSession.sessionId,
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

export function onDraftletMessage(state: SidePanelState, panel: PanelController, message: DraftletMessage): void {
  if (message.type === WORKSPACE_SESSION_UPDATED) {
    if (shouldApplySessionUpdate(state, message.session)) {
      applySession(state, panel, message.session);
    }
    return;
  }

  if (message.type === CONVERSATION_THREAD_UPDATED) {
    if (state.runtime.currentSession?.sessionId === message.sessionId) {
      applyThreadSnapshot(state, panel, message.snapshot);
    }
    return;
  }

  if (message.type === DRAFT_TEXT_DELTA_RECEIVED) {
    if (state.runtime.currentSession?.sessionId === message.sessionId) {
      panel.appendDraftTextDelta(message);
    }
    return;
  }

  if (message.type === INSERTION_IN_PROGRESS) {
    if (state.runtime.currentSession?.sessionId === message.sessionId) {
      onInsertionInProgress(state, panel, message.message);
    }
    return;
  }
}
