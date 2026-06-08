import '../components/panel/panel.css';

import { DEFAULT_PANEL_VIEW, DEFAULT_TONE } from '../core/constants';
import {
  CANCEL_DRAFT_GENERATION,
  DRAFT_GENERATION_COMPLETED,
  DRAFT_GENERATION_FAILED,
  DRAFT_GENERATION_STARTED,
  DRAFT_REPLY_RECEIVED,
  GET_RUNTIME_STATUS,
  GET_SIDE_PANEL_CONTEXT,
  INSERT_REPLY,
  SIDE_PANEL_CONTEXT_UPDATED,
  START_DRAFT_GENERATION,
  type DraftletMessage,
  type DraftletSidePanelContext,
  type InsertReplyResult,
  type RuntimeStatusResult,
  type SidePanelContextResult,
  type StartDraftGenerationResult,
} from '../core/messages';
import { getSavedPanelView, getSavedTone, savePanelView, saveTone } from '../core/storage';
import type { InsertionResult, PanelView, Tone } from '../core/types';
import { mountDraftletPanel } from '../ui/mount-panel';

let currentContext: DraftletSidePanelContext | null = null;
let currentTone: Tone = DEFAULT_TONE;
let currentPanelView: PanelView = DEFAULT_PANEL_VIEW;
let activeGenerationId: string | null = null;

const root = document.getElementById('root');

if (!root) {
  throw new Error('Draftlet side panel root was not found.');
}

const mountedPanel = mountDraftletPanel(root, {
  initialTone: currentTone,
  initialView: currentPanelView,
  surface: 'sidepanel',
  onToneChange(tone) {
    currentTone = tone;
    currentContext = currentContext ? { ...currentContext, tone } : currentContext;
    void saveTone(tone);
  },
  onViewChange(activeView) {
    currentPanelView = activeView;
    currentContext = currentContext ? { ...currentContext, activeView } : currentContext;
    void savePanelView(activeView);
  },
  onGenerate() {
    void generateReplies();
  },
  onInsert(replyText) {
    return insertIntoActivePage(replyText);
  },
  onCloseRequest() {
    void closeSidePanel();
  },
  onAfterRender() {},
});

const panel = mountedPanel.controller;

void initializeSidePanel();

browser.runtime.onMessage.addListener((message: DraftletMessage) => {
  handleDraftletMessage(message);
  return undefined;
});

async function initializeSidePanel() {
  const [tone, panelView] = await Promise.all([getSavedTone(), getSavedPanelView()]);
  currentTone = tone;
  currentPanelView = panelView;
  panel.setTone(tone);
  panel.setActiveView(panelView);

  await refreshHealth();

  try {
    const response = await browser.runtime.sendMessage({
      type: GET_SIDE_PANEL_CONTEXT,
    } satisfies DraftletMessage) as SidePanelContextResult;

    if (response.context) {
      applyContext(response.context);
      return;
    }
  } catch {
    // The side panel can still show history without page context.
  }

  panel.open({
    selectedText: 'Select text on a page and click Draftlet to begin.',
    tone: currentTone,
    activeView: currentPanelView,
  });
}

function handleDraftletMessage(message: DraftletMessage) {
  if (message.type === SIDE_PANEL_CONTEXT_UPDATED) {
    applyContext(message.context);
    return;
  }

  if (message.type === DRAFT_GENERATION_STARTED && message.generationId === activeGenerationId) {
    panel.setConnectionStatus('connected');
    panel.setState('streaming');
    return;
  }

  if (message.type === DRAFT_REPLY_RECEIVED && message.generationId === activeGenerationId) {
    panel.addReply(message.reply);
    return;
  }

  if (message.type === DRAFT_GENERATION_COMPLETED && message.generationId === activeGenerationId) {
    activeGenerationId = null;
    panel.setState(message.replyCount > 0 ? 'success' : 'error', 'No replies returned.');
    return;
  }

  if (message.type === DRAFT_GENERATION_FAILED && message.generationId === activeGenerationId) {
    activeGenerationId = null;
    panel.setConnectionStatus('disconnected');
    panel.setState('error', message.error.message);
  }
}

function applyContext(context: DraftletSidePanelContext) {
  const tone = context.tone ?? currentTone;
  const activeView = context.activeView ?? currentPanelView;

  currentContext = {
    ...context,
    tone,
    activeView,
  };
  currentTone = tone;
  currentPanelView = activeView;

  panel.open({
    selectedText: context.selectedText,
    tone,
    activeView,
  });
  void refreshHealth();
}

async function refreshHealth() {
  try {
    const response = await browser.runtime.sendMessage({
      type: GET_RUNTIME_STATUS,
    } satisfies DraftletMessage) as RuntimeStatusResult;

    panel.setConnectionStatus(response.status);
    return response.status === 'connected';
  } catch {
    panel.setConnectionStatus('disconnected');
    return false;
  }
}

async function generateReplies() {
  if (!currentContext?.selectedText) {
    panel.setState('error', 'Select text on a page before generating replies.');
    return;
  }

  await cancelActiveGeneration();
  panel.clearReplies();
  panel.setState('loading');

  try {
    const response = await browser.runtime.sendMessage({
      type: START_DRAFT_GENERATION,
      context: {
        ...currentContext,
        tone: currentTone,
        activeView: currentPanelView,
      },
    } satisfies DraftletMessage) as StartDraftGenerationResult;

    if (!response.started || !response.generationId) {
      panel.setState('error', response.error?.message ?? 'Could not start draft generation.');
      return;
    }

    activeGenerationId = response.generationId;
  } catch (error) {
    panel.setConnectionStatus('disconnected');
    panel.setState(
      'error',
      error instanceof Error ? error.message : 'Could not reach the Draftlet extension coordinator.',
    );
  }
}

async function insertIntoActivePage(replyText: string): Promise<InsertionResult> {
  try {
    const response = await browser.runtime.sendMessage({
      type: INSERT_REPLY,
      replyText,
    } satisfies DraftletMessage) as InsertReplyResult;

    if (response.result.status !== 'failed') {
      return response.result;
    }
  } catch {
    // Fall through to clipboard fallback below.
  }

  try {
    await navigator.clipboard.writeText(replyText);
    return { status: 'copied', message: 'Copied instead' };
  } catch {
    return { status: 'failed', message: 'Insert failed' };
  }
}

async function closeSidePanel() {
  await cancelActiveGeneration();

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

async function cancelActiveGeneration() {
  if (!activeGenerationId) {
    return;
  }

  const generationId = activeGenerationId;
  activeGenerationId = null;

  await browser.runtime.sendMessage({
    type: CANCEL_DRAFT_GENERATION,
    generationId,
  } satisfies DraftletMessage).catch(() => {});
}
