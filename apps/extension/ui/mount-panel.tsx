import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { DEFAULT_PANEL_VIEW, DEFAULT_TONE } from '../core/constants';
import type {
  ConversationThreadSnapshot,
  DomainHistoryItem,
  RecaptureInsertionTargetOutcome,
  RecaptureStatusTrailItem,
} from '../core/messages';
import type { PlausibleTabCandidate } from '../core/tab-disambiguation';
import type {
  ConnectionStatus,
  InsertionResult,
  InsertionTargetStatus,
  PanelState,
  PanelView,
  Tone,
} from '../core/types';
import { DraftletPanel } from '../components/panel/draftlet-panel';


export interface PanelOpenOptions {
  selectedText: string;
  tone?: Tone;
  activeView?: PanelView;
}

export interface VariantActionResult {
  ok: boolean;
  message: string;
}

export interface InsertionTargetViewState {
  status: InsertionTargetStatus;
  message?: string;
  outcome?: RecaptureInsertionTargetOutcome;
  selectedTab?: PlausibleTabCandidate;
  candidates?: PlausibleTabCandidate[];
  trail?: RecaptureStatusTrailItem[];
}

export type PanelAction =
  | { type: 'open'; options: PanelOpenOptions }
  | { type: 'setTone'; tone: Tone }
  | { type: 'setActiveView'; activeView: PanelView }
  | { type: 'setConnectionStatus'; status: ConnectionStatus }
  | { type: 'setInsertionTargetStatus'; target: InsertionTargetViewState }
  | { type: 'setState'; state: PanelState; message: string }
  | { type: 'setThreadSnapshot'; snapshot: ConversationThreadSnapshot | null };

export interface PanelController {
  open(options: PanelOpenOptions): void;
  setTone(tone: Tone): void;
  getTone(): Tone;
  setActiveView(activeView: PanelView): void;
  getActiveView(): PanelView;
  setConnectionStatus(status: ConnectionStatus): void;
  setInsertionTargetStatus(target: InsertionTargetViewState): void;
  setState(state: PanelState, message?: string): void;
  setThreadSnapshot(snapshot: ConversationThreadSnapshot | null): void;
  subscribe(listener: (action: PanelAction) => void): () => void;
}

export interface PanelCallbacks {
  initialTone?: Tone;
  initialView?: PanelView;
  onToneChange?: (tone: Tone) => void;
  onViewChange?: (activeView: PanelView) => void;
  onGenerate: () => void;
  onRefine?: (instruction: string) => void;
  onLoadHistory?: () => Promise<DomainHistoryItem[]>;
  onRestoreHistoryItem?: (item: DomainHistoryItem) => Promise<VariantActionResult>;
  onInsert: (replyText: string, variantId?: string) => Promise<InsertionResult>;
  onRecaptureInsertionTarget?: (tabId?: number) => Promise<VariantActionResult>;
  onActivateRecaptureTab?: (tabId: number) => Promise<VariantActionResult>;
  onSelectVariant?: (variantId: string) => Promise<VariantActionResult>;
  onAcceptVariant?: (variantId: string) => Promise<VariantActionResult>;
  onCloseRequest: () => void;
  onAfterRender: () => void;
}

interface MountedPanel {
  controller: PanelController;
  unmount: () => void;
}

export function mountDraftletPanel(container: HTMLElement, callbacks: PanelCallbacks): MountedPanel {
  const controller = createPanelController(
    callbacks.initialTone ?? DEFAULT_TONE,
    callbacks.initialView ?? DEFAULT_PANEL_VIEW,
  );
  const root: Root = createRoot(container);

  root.render(<DraftletPanel callbacks={callbacks} controller={controller} />);

  return {
    controller,
    unmount() {
      root.unmount();
    },
  };
}

function createPanelController(initialTone: Tone, initialView: PanelView): PanelController {
  let currentTone = initialTone;
  let currentView = initialView;
  let listener: ((action: PanelAction) => void) | null = null;
  const pendingActions: PanelAction[] = [];

  const emit = (action: PanelAction) => {
    if (action.type === 'setTone') {
      currentTone = action.tone;
    }

    if (action.type === 'setActiveView') {
      currentView = action.activeView;
    }

    if (action.type === 'open') {
      if (action.options.tone) {
        currentTone = action.options.tone;
      }

      if (action.options.activeView) {
        currentView = action.options.activeView;
      }
    }

    if (!listener) {
      pendingActions.push(action);
      return;
    }

    listener(action);
  };

  return {
    open(options) {
      emit({ type: 'open', options });
    },
    setTone(tone) {
      emit({ type: 'setTone', tone });
    },
    getTone() {
      return currentTone;
    },
    setActiveView(activeView) {
      emit({ type: 'setActiveView', activeView });
    },
    getActiveView() {
      return currentView;
    },
    setConnectionStatus(status) {
      emit({ type: 'setConnectionStatus', status });
    },
    setInsertionTargetStatus(target) {
      emit({ type: 'setInsertionTargetStatus', target });
    },
    setState(state, message = '') {
      emit({ type: 'setState', state, message });
    },
    setThreadSnapshot(snapshot) {
      emit({ type: 'setThreadSnapshot', snapshot });
    },
    subscribe(nextListener) {
      listener = nextListener;

      while (pendingActions.length > 0) {
        nextListener(pendingActions.shift()!);
      }

      return () => {
        if (listener === nextListener) {
          listener = null;
        }
      };
    },
  };
}
