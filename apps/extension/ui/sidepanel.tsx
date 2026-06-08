import '../components/panel/panel.css';

import { DEFAULT_PANEL_VIEW, DEFAULT_TONE } from '../core/constants';
import {
  CANCEL_DRAFT_GENERATION,
  CONVERSATION_THREAD_UPDATED,
  DRAFT_GENERATION_COMPLETED,
  DRAFT_GENERATION_FAILED,
  DRAFT_GENERATION_STARTED,
  CONVERSATION_THREAD_UPDATED,
  DRAFT_VARIANT_RECEIVED,
  GET_CURRENT_WORKSPACE_SESSION,
  GET_RUNTIME_STATUS,
  INSERT_REPLY,
  WORKSPACE_SESSION_UPDATED,
  START_DRAFT_GENERATION,
  type ConversationThreadSnapshot,
  type DraftletMessage,
  type InsertReplyResult,
  type RuntimeStatusResult,
  type StartDraftGenerationResult,
  type ConversationThreadSnapshot,
  type WorkspaceSession,
  type WorkspaceSessionResult,
} from '../core/messages';
import { getSavedPanelView, getSavedTone, savePanelView, saveTone } from '../core/storage';
import type { InsertionResult, PanelView, Tone } from '../core/types';
import { mountDraftletPanel } from '../ui/mount-panel';

let currentSession: WorkspaceSession | null = null;
let currentTone: Tone = DEFAULT_TONE;
let currentPanelView: PanelView = DEFAULT_PANEL_VIEW;
let activeGenerationId: string | null = null;
let activeGenerationSessionId: string | null = null;
let currentThreadSnapshot: ConversationThreadSnapshot | null = null;

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
    currentSession = currentSession ? {
      ...currentSession,
      latestContext: {
        ...currentSession.latestContext,
        tone,
      },
    } : currentSession;
    void saveTone(tone);
  },
  onViewChange(activeView) {
    currentPanelView = activeView;
    currentSession = currentSession ? {
      ...currentSession,
      latestContext: {
        ...currentSession.latestContext,
        activeView,
      },
    } : currentSession;
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
      type: GET_CURRENT_WORKSPACE_SESSION,
    } satisfies DraftletMessage) as WorkspaceSessionResult;

    if (response.session) {
      applySession(response.session);

      if (response.thread) {
        applyThreadSnapshot(response.thread, true);
      }

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
  if (message.type === WORKSPACE_SESSION_UPDATED) {
    if (shouldApplySessionUpdate(message.session)) {
      applySession(message.session);
    }
    return;
  }

  if (message.type === CONVERSATION_THREAD_UPDATED) {
    if (currentSession?.sessionId === message.sessionId) {
      currentThreadSnapshot = message.snapshot;
    }
    return;
  }

  if (
    message.type === DRAFT_GENERATION_STARTED
    && message.sessionId === activeGenerationSessionId
    && message.generationId === activeGenerationId
  ) {
    panel.setConnectionStatus('connected');
    panel.setState('streaming');
    return;
  }

  if (message.type === CONVERSATION_THREAD_UPDATED) {
    if (currentSession?.sessionId === message.sessionId) {
      applyThreadSnapshot(message.snapshot, false);
    }
    return;
  }

  if (
    message.type === DRAFT_VARIANT_RECEIVED
    && message.sessionId === activeGenerationSessionId
    && message.generationId === activeGenerationId
  ) {
    panel.addReply({
      id: message.variant.variantId,
      text: message.variant.content,
      persistedId: message.variant.persistedReplyId,
    });
    return;
  }

  if (
    message.type === DRAFT_GENERATION_COMPLETED
    && message.sessionId === activeGenerationSessionId
    && message.generationId === activeGenerationId
  ) {
    clearActiveGeneration();
    panel.setState(message.variants.length > 0 ? 'success' : 'error', 'No replies returned.');
    return;
  }

  if (
    message.type === DRAFT_GENERATION_FAILED
    && message.sessionId === activeGenerationSessionId
    && message.generationId === activeGenerationId
  ) {
    clearActiveGeneration();
    panel.setConnectionStatus('disconnected');
    panel.setState('error', message.error.message);
  }
}

function applyThreadSnapshot(snapshot: ConversationThreadSnapshot, renderLatestTurn: boolean) {
  currentThreadSnapshot = snapshot;

  if (!renderLatestTurn) {
    return;
  }

  const latestTurn = [...snapshot.turns].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);

  if (!latestTurn) {
    return;
  }

  const variants = snapshot.variants
    .filter((variant) => variant.turnId === latestTurn.turnId)
    .sort((a, b) => a.rank - b.rank);

  if (variants.length === 0) {
    return;
  }

  panel.clearReplies();
  for (const variant of variants) {
    panel.addReply({
      id: variant.variantId,
      text: variant.content,
      persistedId: variant.persistedReplyId,
    });
  }
  panel.setState('success');
}

function shouldApplySessionUpdate(session: WorkspaceSession): boolean {
  return !currentSession
    || currentSession.sessionId === session.sessionId
    || currentSession.tabId === session.tabId;
}

function applySession(session: WorkspaceSession) {
  const previousSession = currentSession;
  const tone = session.latestContext.tone ?? currentTone;
  const activeView = session.latestContext.activeView ?? currentPanelView;
  const shouldOpenSession = !previousSession
    || previousSession.sessionId !== session.sessionId
    || previousSession.pageUrl !== session.pageUrl
    || previousSession.latestContext.selectedText !== session.latestContext.selectedText;

  currentSession = {
    ...session,
    latestContext: {
      ...session.latestContext,
      tone,
      activeView,
    },
  };
  currentTone = tone;
  currentPanelView = activeView;

  if (shouldOpenSession) {
    panel.open({
      selectedText: session.latestContext.selectedText,
      tone,
      activeView,
    });
  }

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
  if (!currentSession?.latestContext.selectedText) {
    panel.setState('error', 'Select text on a page before generating replies.');
    return;
  }

  await cancelActiveGeneration();
  panel.clearReplies();
  panel.setState('loading');

  try {
    const response = await browser.runtime.sendMessage({
      type: START_DRAFT_GENERATION,
      sessionId: currentSession.sessionId,
      tone: currentTone,
      activeView: currentPanelView,
    } satisfies DraftletMessage) as StartDraftGenerationResult;

    if (!response.started || !response.generationId || !response.sessionId) {
      panel.setState('error', response.error?.message ?? 'Could not start draft generation.');
      return;
    }

    activeGenerationId = response.generationId;
    activeGenerationSessionId = response.sessionId;
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
      sessionId: currentSession?.sessionId,
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
  if (!activeGenerationId || !activeGenerationSessionId) {
    return;
  }

  const generationId = activeGenerationId;
  const sessionId = activeGenerationSessionId;
  clearActiveGeneration();

  await browser.runtime.sendMessage({
    type: CANCEL_DRAFT_GENERATION,
    sessionId,
    generationId,
  } satisfies DraftletMessage).catch(() => {});
}

function clearActiveGeneration() {
  activeGenerationId = null;
  activeGenerationSessionId = null;
}
