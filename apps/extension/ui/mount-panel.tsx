import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { DEFAULT_PANEL_VIEW, DEFAULT_TONE } from '../core/constants';
import type { ConversationThreadSnapshot, DomainHistoryItem } from '../core/messages';
import type {
  ConnectionStatus,
  InsertionResult,
  PanelState,
  PanelView,
  ReplyItem,
  StreamedReply,
  Tone,
} from '../core/types';
import { DraftletPanel } from '../components/panel/DraftletPanel';

export type PanelSurface = 'overlay' | 'sidepanel';

export interface PanelOpenOptions {
  selectedText: string;
  tone?: Tone;
  activeView?: PanelView;
}

export interface VariantActionResult {
  ok: boolean;
  message: string;
}

export type PanelAction =
  | { type: 'open'; options: PanelOpenOptions }
  | { type: 'setTone'; tone: Tone }
  | { type: 'setActiveView'; activeView: PanelView }
  | { type: 'setConnectionStatus'; status: ConnectionStatus }
  | { type: 'setState'; state: PanelState; message: string }
  | { type: 'setThreadSnapshot'; snapshot: ConversationThreadSnapshot | null }
  | { type: 'clearReplies' }
  | { type: 'addReply'; reply: ReplyItem };

export interface PanelController {
  open(options: PanelOpenOptions): void;
  setTone(tone: Tone): void;
  getTone(): Tone;
  setActiveView(activeView: PanelView): void;
  getActiveView(): PanelView;
  setConnectionStatus(status: ConnectionStatus): void;
  setState(state: PanelState, message?: string): void;
  setThreadSnapshot(snapshot: ConversationThreadSnapshot | null): void;
  clearReplies(): void;
  addReply(reply: StreamedReply | ReplyItem): void;
  subscribe(listener: (action: PanelAction) => void): () => void;
}

export interface PanelCallbacks {
  initialTone?: Tone;
  initialView?: PanelView;
  surface?: PanelSurface;
  onToneChange?: (tone: Tone) => void;
  onViewChange?: (activeView: PanelView) => void;
  onGenerate: () => void;
  onRefine?: (instruction: string) => void;
  onLoadHistory?: () => Promise<DomainHistoryItem[]>;
  onRestoreHistoryItem?: (item: DomainHistoryItem) => Promise<VariantActionResult>;
  onInsert: (replyText: string, variantId?: string) => Promise<InsertionResult>;
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
    setState(state, message = '') {
      emit({ type: 'setState', state, message });
    },
    setThreadSnapshot(snapshot) {
      emit({ type: 'setThreadSnapshot', snapshot });
    },
    clearReplies() {
      emit({ type: 'clearReplies' });
    },
    addReply(reply) {
      emit({
        type: 'addReply',
        reply: 'id' in reply
          ? reply
          : {
            id: reply.replyId ? `reply-${reply.replyId}` : crypto.randomUUID(),
            text: reply.text,
            persistedId: reply.replyId,
          },
      });
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
