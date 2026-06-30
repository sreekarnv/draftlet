import { DEFAULT_PANEL_VIEW, DEFAULT_TONE } from '../../core/constants';
import type { DomainHistoryItem, DraftletMessage } from '../../core/messages';
import type { InsertionResult, PanelView, Tone } from '../../core/types';
import { mountDraftletPanel, type PanelController, type VariantActionResult } from '../mount-panel';
import {
  acceptVariant,
  cancelActiveGeneration,
  closeSidePanel,
  configureSendMessage,
  generateReplies,
  initializeSidePanel,
  loadDomainHistory,
  onDraftletMessage,
  refreshHealth,
  refreshInsertionTargetStatus,
  refineReplies,
  restoreDomainHistoryItem,
  retryInterruptedTurn,
  setActiveView,
  setTone,
  setVariantCurrent,
  startDraftGenerationFromCurrentSession,
  insertIntoActivePage,
  type SidePanelStorage,
} from './actions';
import { createInitialState, type SidePanelState } from './state';
import { sendRuntimeMessage, type SendMessage } from './runtime-message-bus';

export interface SidePanelController {
  initialize(): Promise<void>;
  onMessage(message: DraftletMessage): void;
  panel: PanelController;
  getState(): SidePanelState;
  unmount(): void;
  setTone(tone: Tone): void;
  setActiveView(view: PanelView): void;
  startDraftGeneration(): Promise<{ ok: boolean; message?: string }>;
  insertIntoActivePage(replyText: string, variantId?: string): Promise<InsertionResult>;
  cancelActiveGeneration(): Promise<void>;
  closeSidePanel(): Promise<void>;
  refreshHealth(): Promise<boolean>;
  refreshInsertionTargetStatus(): Promise<void>;
  setSendMessage(fn: SendMessage): void;
}

export interface SidePanelControllerOptions {
  root: HTMLElement;
  storage: SidePanelStorage;
  sendMessage?: SendMessage;
}

export function createSidePanelController(options: SidePanelControllerOptions): SidePanelController {
  const { root, storage } = options;
  const state = createInitialState(DEFAULT_TONE, DEFAULT_PANEL_VIEW);
  let panel: PanelController;
  const mounted = mountDraftletPanel(root, {
    initialTone: state.ui.currentTone,
    initialView: state.ui.currentPanelView,
    onToneChange: (tone) => {
      setTone(state, panel, storage, tone);
    },
    onViewChange: (activeView) => {
      setActiveView(state, panel, storage, activeView);
    },
    onGenerate: () => {
      void generateReplies(state, panel);
    },
    onRetryInterruptedTurn: (turnId: string) => retryInterruptedTurn(state, panel, turnId),
    onRefine: (instruction: string) => {
      void refineReplies(state, panel, instruction);
    },
    onLoadHistory: () => loadDomainHistory(state, panel),
    onRestoreHistoryItem: (item: DomainHistoryItem) => restoreDomainHistoryItem(state, panel, item),
    onInsert: (replyText, variantId) => insertIntoActivePage(state, panel, replyText, variantId),
    onSelectVariant: (variantId) => setVariantCurrent(state, panel, variantId),
    onAcceptVariant: (variantId) => acceptVariant(state, panel, variantId),
    onCancelGeneration: () => {
      void cancelActiveGeneration(state);
    },
    onCloseRequest: () => {
      void closeSidePanel(state);
    },
    onAfterRender: () => {},
  });
  panel = mounted.controller;

  const initialSend = options.sendMessage ?? sendRuntimeMessage;
  configureSendMessage(initialSend);

  return {
    panel,
    unmount: mounted.unmount,
    getState: () => state,
    setTone: (tone) => setTone(state, panel, storage, tone),
    setActiveView: (view) => setActiveView(state, panel, storage, view),
    startDraftGeneration: () => startDraftGenerationFromCurrentSession(state, panel),
    insertIntoActivePage: (replyText, variantId) => insertIntoActivePage(state, panel, replyText, variantId),
    cancelActiveGeneration: () => cancelActiveGeneration(state),
    closeSidePanel: () => closeSidePanel(state),
    refreshHealth: () => refreshHealth(state, panel),
    refreshInsertionTargetStatus: () => refreshInsertionTargetStatus(state, panel, initialSend),
    setSendMessage: (fn) => configureSendMessage(fn),
    initialize: () => initializeSidePanel(state, panel, storage),
    onMessage: (message) => onDraftletMessage(state, panel, message),
  };
}

export type { VariantActionResult };
