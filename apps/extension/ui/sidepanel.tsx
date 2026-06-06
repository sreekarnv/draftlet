import '../components/panel/panel.css';

import { checkServerHealth, streamReplies } from '../core/api';
import { DEFAULT_PANEL_VIEW, DEFAULT_TONE } from '../core/constants';
import {
  GET_SIDE_PANEL_CONTEXT,
  INSERT_REPLY,
  SIDE_PANEL_CONTEXT_UPDATED,
  type DraftletMessage,
  type DraftletSidePanelContext,
  type InsertReplyResult,
  type SidePanelContextResult,
} from '../core/messages';
import { getSavedPanelView, getSavedTone, savePanelView, saveTone } from '../core/storage';
import type { InsertionResult, PanelView, Tone } from '../core/types';
import { mountDraftletPanel } from '../ui/mount-panel';

let currentContext: DraftletSidePanelContext | null = null;
let currentTone: Tone = DEFAULT_TONE;
let currentPanelView: PanelView = DEFAULT_PANEL_VIEW;
let activeRequest: AbortController | null = null;

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
  if (message.type === SIDE_PANEL_CONTEXT_UPDATED) {
    applyContext(message.context);
  }

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

function applyContext(context: DraftletSidePanelContext) {
  currentContext = context;
  currentTone = context.tone;
  currentPanelView = context.activeView;

  panel.open({
    selectedText: context.selectedText,
    tone: context.tone,
    activeView: context.activeView,
  });
  void refreshHealth();
}

async function refreshHealth() {
  const connected = await checkServerHealth();
  panel.setConnectionStatus(connected ? 'connected' : 'disconnected');
  return connected;
}

async function generateReplies() {
  if (!currentContext?.selectedText) {
    panel.setState('error', 'Select text on a page before generating replies.');
    return;
  }

  abortActiveRequest();
  activeRequest = new AbortController();
  let replyCount = 0;

  panel.clearReplies();
  panel.setState('loading');

  try {
    const connected = await refreshHealth();

    if (!connected) {
      panel.setState('error', 'Draftlet server is not reachable.');
      return;
    }

    await streamReplies(
      {
        selected_text: currentContext.selectedText,
        tone: currentTone,
        source_url: currentContext.sourceUrl,
        source_domain: currentContext.sourceDomain,
      },
      {
        signal: activeRequest.signal,
        onReply(reply) {
          replyCount += 1;
          panel.addReply(reply);
        },
      },
    );

    panel.setState(replyCount > 0 ? 'success' : 'error', 'No replies returned.');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }

    panel.setConnectionStatus('disconnected');
    panel.setState(
      'error',
      error instanceof Error ? error.message : 'Could not stream replies from the local server.',
    );
  } finally {
    activeRequest = null;
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
  abortActiveRequest();

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

function abortActiveRequest() {
  activeRequest?.abort();
  activeRequest = null;
}
