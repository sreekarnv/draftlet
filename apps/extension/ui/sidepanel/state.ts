import type { ConversationThreadSnapshot, InsertionStatusTrailItem, WorkspaceSession } from '../../core/messages';
import type { PanelView, Tone } from '../../core/types';

export const MAX_INSERTION_TRAIL_ITEMS = 4;

export interface SidePanelRuntimeState {
  currentSession: WorkspaceSession | null;
  currentThreadSnapshot: ConversationThreadSnapshot | null;
}

export interface SidePanelUiState {
  currentTone: Tone;
  currentPanelView: PanelView;
  selectedThreadId: string | null;
  selectedVariantId: string | null;
  insertionTrail: InsertionStatusTrailItem[];
  isInsertInProgress: boolean;
  insertInProgressMessage: string;
}

export interface SidePanelState {
  runtime: SidePanelRuntimeState;
  ui: SidePanelUiState;
}

export function createInitialState(initialTone: Tone, initialView: PanelView): SidePanelState {
  return {
    runtime: {
      currentSession: null,
      currentThreadSnapshot: null,
    },
    ui: {
      currentTone: initialTone,
      currentPanelView: initialView,
      selectedThreadId: null,
      selectedVariantId: null,
      insertionTrail: [],
      isInsertInProgress: false,
      insertInProgressMessage: '',
    },
  };
}

export function shouldApplySessionUpdate(state: SidePanelState, session: WorkspaceSession): boolean {
  return !state.runtime.currentSession
    || state.runtime.currentSession.sessionId === session.sessionId
    || state.runtime.currentSession.tabId === session.tabId;
}
