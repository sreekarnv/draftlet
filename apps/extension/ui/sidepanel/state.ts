import type { ConversationThreadSnapshot, RecaptureStatusTrailItem, WorkspaceSession } from '../../core/messages';
import type { PanelView, Tone } from '../../core/types';

export const MAX_RECAPTURE_TRAIL_ITEMS = 4;

export interface SidePanelState {
  currentSession: WorkspaceSession | null;
  currentThreadSnapshot: ConversationThreadSnapshot | null;
  currentTone: Tone;
  currentPanelView: PanelView;
  recaptureTrail: RecaptureStatusTrailItem[];
  isInsertInProgress: boolean;
  insertInProgressMessage: string;
}

export function createInitialState(initialTone: Tone, initialView: PanelView): SidePanelState {
  return {
    currentSession: null,
    currentThreadSnapshot: null,
    currentTone: initialTone,
    currentPanelView: initialView,
    recaptureTrail: [],
    isInsertInProgress: false,
    insertInProgressMessage: '',
  };
}

export function shouldApplySessionUpdate(state: SidePanelState, session: WorkspaceSession): boolean {
  return !state.currentSession
    || state.currentSession.sessionId === session.sessionId
    || state.currentSession.tabId === session.tabId;
}
