import {
  GET_INSERTION_TARGET_STATUS,
  INSERT_REPLY,
  type DraftletMessage,
  type InsertReplyResult,
  type InsertionTargetStatusResult,
} from '../../../core/messages';
import type { InsertionResult } from '../../../core/types';
import {
  appendTrail,
  insertionTargetMessage,
} from '../../../components/panel/insertion-status-trail';
import type { PanelController } from '../../mount-panel';
import type { SendMessage } from '../runtime-message-bus';
import type { SidePanelState } from '../state';
import { getSendMessage } from './message-client';
import { buildCurrentRestoreState } from './restore-state';

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

export function setSessionInsertionTargetStatus(state: SidePanelState, panel: PanelController): void {
  if (!state.currentSession) {
    return;
  }

  panel.setInsertionTargetStatus({
    status: state.currentSession.insertionTargetStatus ?? (state.currentSession.insertionTarget ? 'stale' : 'needs_recapture'),
    message: insertionTargetMessage(state.currentSession),
    candidates: state.currentSession.plausibleTabs,
    trail: state.insertionTrail,
  });
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
    const response = await getSendMessage()<InsertReplyResult>({
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
    const message = 'Draftlet could not find a compose field, so it copied the draft.';
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
    const message = 'Draftlet could not find a compose field. Use Copy and paste manually.';
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
