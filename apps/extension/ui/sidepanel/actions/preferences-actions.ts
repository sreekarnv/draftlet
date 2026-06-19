import {
  GET_CURRENT_WORKSPACE_SESSION,
  GET_RUNTIME_STATUS,
  type DraftletMessage,
  type RuntimeStatusResult,
  type WorkspaceSessionResult,
} from '../../../core/messages';
import type { PanelView, Tone } from '../../../core/types';
import type { PanelController } from '../../mount-panel';
import type { SidePanelState } from '../state';
import type { SidePanelStorage } from './action-types';
import { getSendMessage } from './message-client';
import { applySession, applyThreadSnapshot } from './thread-actions';

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

export async function refreshHealth(state: SidePanelState, panel: PanelController): Promise<boolean> {
  try {
    const response = await getSendMessage()<RuntimeStatusResult>({
      type: GET_RUNTIME_STATUS,
    } satisfies DraftletMessage);

    panel.setConnectionStatus(response.status);
    return response.status === 'connected';
  } catch {
    panel.setConnectionStatus('disconnected');
    return false;
  }
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
    const response = await getSendMessage()<WorkspaceSessionResult>({
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
