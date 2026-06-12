import '../components/panel/panel.css';

import { DEFAULT_PANEL_VIEW, DEFAULT_TONE } from '../core/constants';
import {
  ACCEPT_DRAFT_VARIANT,
  ACTIVATE_RECAPTURE_TAB,
  CANCEL_DRAFT_GENERATION,
  CONVERSATION_THREAD_UPDATED,
  DRAFT_GENERATION_COMPLETED,
  DRAFT_GENERATION_FAILED,
  DRAFT_GENERATION_STARTED,
  GET_CURRENT_WORKSPACE_SESSION,
  GET_DOMAIN_HISTORY,
  GET_INSERTION_TARGET_STATUS,
  GET_RUNTIME_STATUS,
  INSERT_REPLY,
  RECAPTURE_INSERTION_TARGET,
  RESTORE_DOMAIN_THREAD,
  SET_CURRENT_DRAFT_VARIANT,
  WORKSPACE_SESSION_UPDATED,
  START_DRAFT_GENERATION,
  START_DRAFT_REFINEMENT,
  type ConversationThreadSnapshot,
  type ActivateRecaptureTabResult,
  type DomainHistoryItem,
  type DomainHistoryResult,
  type DraftletMessage,
  type DraftVariantStateResult,
  type InsertReplyResult,
  type InsertionTargetStatusResult,
  type RecaptureInsertionTargetResult,
  type RecaptureStatusTrailEvent,
  type RecaptureStatusTrailItem,
  type RecaptureStatusTrailLevel,
  type RestoreDomainThreadResult,
  type RuntimeStatusResult,
  type StartDraftGenerationResult,
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
let recaptureTrail: RecaptureStatusTrailItem[] = [];
const MAX_RECAPTURE_TRAIL_ITEMS = 4;

const root = document.getElementById('root');

if (!root) {
  throw new Error('Draftlet side panel root was not found.');
}

const mountedPanel = mountDraftletPanel(root, {
  initialTone: currentTone,
  initialView: currentPanelView,
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
  onRefine(instruction) {
    void refineReplies(instruction);
  },
  onLoadHistory() {
    return loadDomainHistory();
  },
  onRestoreHistoryItem(item) {
    return restoreDomainHistoryItem(item);
  },
  onInsert(replyText, variantId) {
    return insertIntoActivePage(replyText, variantId);
  },
  onRecaptureInsertionTarget(tabId) {
    return recaptureInsertionTarget(tabId);
  },
  onActivateRecaptureTab(tabId) {
    return activateRecaptureTab(tabId);
  },
  onSelectVariant(variantId) {
    return setVariantCurrent(variantId);
  },
  onAcceptVariant(variantId) {
    return acceptVariant(variantId);
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
        applyThreadSnapshot(response.thread);
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
      applyThreadSnapshot(message.snapshot);
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

function applyThreadSnapshot(snapshot: ConversationThreadSnapshot) {
  panel.setThreadSnapshot(snapshot);
  applyPanelStateFromThread(snapshot);
}

function applyPanelStateFromThread(snapshot: ConversationThreadSnapshot) {
  const latestTurn = [...snapshot.turns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).at(0);

  if (!latestTurn) {
    return;
  }

  if (latestTurn.generationStatus === 'queued' || latestTurn.generationStatus === 'started') {
    panel.setState('loading');
    return;
  }

  if (latestTurn.generationStatus === 'streaming') {
    panel.setState('streaming');
    return;
  }

  if (latestTurn.generationStatus === 'completed') {
    const hasVariants = snapshot.variants.some((variant) => variant.turnId === latestTurn.turnId);
    panel.setState(hasVariants ? 'success' : 'error', hasVariants ? '' : 'No replies returned.');
    return;
  }

  if (latestTurn.generationStatus === 'failed') {
    panel.setState('error', latestTurn.generationErrorMessage ?? 'Could not generate replies.');
    return;
  }

  if (latestTurn.generationStatus === 'cancelled') {
    panel.setState('error', latestTurn.generationErrorMessage ?? 'Draft generation was cancelled.');
  }
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

  if (previousSession?.sessionId !== session.sessionId) {
    recaptureTrail = [];
  }

  if (shouldOpenSession) {
    panel.open({
      selectedText: session.latestContext.selectedText,
      tone,
      activeView,
    });
  }

  panel.setInsertionTargetStatus({
    status: session.insertionTargetStatus ?? (session.insertionTarget ? 'stale' : 'needs_recapture'),
    message: insertionTargetMessage(session),
    candidates: session.plausibleTabs,
    trail: recaptureTrail,
  });

  if (shouldOpenSession) {
    void refreshInsertionTargetStatus();
  }
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

async function refreshInsertionTargetStatus() {
  if (!currentSession) {
    panel.setInsertionTargetStatus({
      status: 'needs_recapture',
      message: 'Open Draftlet from a compose field to enable insertion.',
      trail: recaptureTrail,
    });
    return;
  }

  try {
    const response = await browser.runtime.sendMessage({
      type: GET_INSERTION_TARGET_STATUS,
      sessionId: currentSession.sessionId,
    } satisfies DraftletMessage) as InsertionTargetStatusResult;

    panel.setInsertionTargetStatus({
      status: response.status,
      message: response.message,
      candidates: response.candidates,
      trail: recaptureTrail,
    });
  } catch {
    panel.setInsertionTargetStatus({
      status: 'unavailable',
      message: 'Insertion target is unavailable.',
      trail: recaptureTrail,
    });
  }
}

async function loadDomainHistory(): Promise<DomainHistoryItem[]> {
  try {
    const response = await browser.runtime.sendMessage({
      type: GET_DOMAIN_HISTORY,
      limit: 20,
    } satisfies DraftletMessage) as DomainHistoryResult;

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.items;
  } catch (error) {
    panel.setConnectionStatus('disconnected');
    throw error;
  }
}

async function restoreDomainHistoryItem(item: DomainHistoryItem) {
  try {
    const response = await browser.runtime.sendMessage({
      type: RESTORE_DOMAIN_THREAD,
      sessionId: item.session.sessionId,
      threadId: item.thread.thread.threadId,
    } satisfies DraftletMessage) as RestoreDomainThreadResult;

    if (!response.restored || !response.session || !response.thread) {
      return { ok: false, message: response.error?.message ?? 'Could not restore this thread.' };
    }

    applySession(response.session);
    applyThreadSnapshot(response.thread);
    panel.setActiveView('replies');
    return { ok: true, message: 'Restored this thread.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not reach the Draftlet extension coordinator.',
    };
  }
}

async function generateReplies() {
  if (!currentSession?.latestContext.selectedText) {
    panel.setState('error', 'Select text on a page before generating replies.');
    return;
  }

  await cancelActiveGeneration();
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


async function refineReplies(instruction: string) {
  if (!currentSession?.latestContext.selectedText) {
    panel.setState('error', 'Select text on a page before refining replies.');
    return;
  }

  const trimmedInstruction = instruction.trim();

  if (!trimmedInstruction) {
    panel.setState('error', 'Add a follow-up instruction before refining drafts.');
    return;
  }

  await cancelActiveGeneration();
  panel.setState('loading');

  try {
    const response = await browser.runtime.sendMessage({
      type: START_DRAFT_REFINEMENT,
      sessionId: currentSession.sessionId,
      instruction: trimmedInstruction,
      tone: currentTone,
      activeView: currentPanelView,
    } satisfies DraftletMessage) as StartDraftGenerationResult;

    if (!response.started || !response.generationId || !response.sessionId) {
      panel.setState('error', response.error?.message ?? 'Could not start draft refinement.');
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

async function setVariantCurrent(variantId: string) {
  return updateVariantState(variantId, SET_CURRENT_DRAFT_VARIANT, 'Selected this draft.');
}

async function acceptVariant(variantId: string) {
  return updateVariantState(variantId, ACCEPT_DRAFT_VARIANT, 'Accepted this draft.');
}

async function updateVariantState(
  variantId: string,
  type: typeof SET_CURRENT_DRAFT_VARIANT | typeof ACCEPT_DRAFT_VARIANT,
  successMessage: string,
) {
  if (!currentSession) {
    return { ok: false, message: 'No active Draftlet session.' };
  }

  try {
    const response = await browser.runtime.sendMessage({
      type,
      sessionId: currentSession.sessionId,
      variantId,
    } satisfies DraftletMessage) as DraftVariantStateResult;

    if (!response.updated || !response.snapshot) {
      return { ok: false, message: response.error?.message ?? 'Could not update this draft.' };
    }

    applyThreadSnapshot(response.snapshot);
    return { ok: true, message: successMessage };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not reach the Draftlet extension coordinator.',
    };
  }
}

async function insertIntoActivePage(replyText: string, variantId?: string): Promise<InsertionResult> {
  await refreshInsertionTargetStatus();

  try {
    const response = await browser.runtime.sendMessage({
      type: INSERT_REPLY,
      sessionId: currentSession?.sessionId,
      replyText,
      variantId,
    } satisfies DraftletMessage) as InsertReplyResult;

    if (response.result.targetStatus) {
      panel.setInsertionTargetStatus({
        status: response.result.targetStatus,
        message: response.result.message,
        trail: recaptureTrail,
      });
    }

    if (response.result.status !== 'failed') {
      return response.result;
    }
  } catch {
    // Fall through to clipboard fallback below.
  }

  try {
    await navigator.clipboard.writeText(replyText);
    return { status: 'copied', message: 'Insertion target unavailable; copied instead.', targetStatus: 'needs_recapture' };
  } catch {
    return { status: 'failed', message: 'Insert failed', targetStatus: 'unavailable' };
  }
}

async function recaptureInsertionTarget(tabId?: number) {
  if (!currentSession) {
    const trail = appendRecaptureTrail('recapture_failed', 'failed', 'Recapture failed: no active session.');
    panel.setInsertionTargetStatus({
      status: 'unavailable',
      message: 'No active Draftlet session.',
      trail,
    });
    return { ok: false, message: 'No active Draftlet session.' };
  }

  const requestedTrail = appendRecaptureTrail(
    'recapture_requested',
    'pending',
    tabId ? 'Retrying recapture in the selected tab.' : 'Recapture requested.',
    tabId,
  );
  panel.setInsertionTargetStatus({
    status: tabId ? 'needs_focus' : 'needs_recapture',
    message: tabId
      ? 'Checking the selected tab for a compose field...'
      : 'Focus a compose field on the page, then recapture.',
    trail: requestedTrail,
  });

  try {
    const response = await browser.runtime.sendMessage({
      type: RECAPTURE_INSERTION_TARGET,
      sessionId: currentSession.sessionId,
      tabId,
    } satisfies DraftletMessage) as RecaptureInsertionTargetResult;

    const responseTrail = appendRecaptureTrail(
      trailEventForRecapture(response),
      trailLevelForRecapture(response),
      response.message,
      response.selectedTab?.tabId ?? tabId,
    );
    panel.setInsertionTargetStatus({
      status: response.status,
      message: response.message,
      outcome: response.outcome,
      selectedTab: response.selectedTab,
      candidates: response.candidates,
      trail: responseTrail,
    });

    if (response.recaptured && response.target) {
      currentSession = {
        ...currentSession,
        insertionTarget: response.target,
        insertionTargetStatus: response.status,
        plausibleTabs: undefined,
        latestContext: {
          ...currentSession.latestContext,
          tabId: tabId ?? currentSession.latestContext.tabId,
          composeTarget: response.target,
        },
      };
    } else if (response.candidates) {
      currentSession = {
        ...currentSession,
        insertionTargetStatus: response.status,
        plausibleTabs: response.candidates,
      };
    } else {
      currentSession = {
        ...currentSession,
        insertionTargetStatus: response.status,
        plausibleTabs: undefined,
      };
    }

    return {
      ok: response.recaptured,
      message: response.message,
    };
  } catch {
    const message = 'Draftlet could not recapture the target. Copy still works.';
    const trail = appendRecaptureTrail('recapture_failed', 'failed', message, tabId);
    panel.setInsertionTargetStatus({
      status: 'unavailable',
      message,
      trail,
    });
    return { ok: false, message };
  }
}

async function activateRecaptureTab(tabId: number) {
  if (!currentSession) {
    appendRecaptureTrail('tab_activation_failed', 'failed', 'Could not open tab: no active session.', tabId);
    return { ok: false, message: 'No active Draftlet session.' };
  }

  appendRecaptureTrail('tab_activation_requested', 'pending', 'Opening selected tab for recapture.', tabId);

  try {
    const response = await browser.runtime.sendMessage({
      type: ACTIVATE_RECAPTURE_TAB,
      sessionId: currentSession.sessionId,
      tabId,
    } satisfies DraftletMessage) as ActivateRecaptureTabResult;

    if (response.activated) {
      const trail = appendRecaptureTrail('tab_activated', 'success', response.message, response.tab?.tabId ?? tabId);
      panel.setInsertionTargetStatus({
        status: 'needs_focus',
        outcome: 'needs_focused_compose_target',
        selectedTab: response.tab,
        message: response.message,
        trail,
      });
      currentSession = {
        ...currentSession,
        tabId,
        latestContext: {
          ...currentSession.latestContext,
          tabId,
        },
        insertionTargetStatus: 'needs_focus',
        plausibleTabs: undefined,
      };
      return { ok: true, message: response.message };
    }

    const trail = appendRecaptureTrail('tab_activation_failed', 'failed', response.message, tabId);
    panel.setInsertionTargetStatus({
      status: 'unavailable',
      message: response.message,
      trail,
    });
    return { ok: false, message: response.message };
  } catch {
    const message = 'Draftlet could not open the selected tab. Switch to it manually, focus the compose field, then retry.';
    const trail = appendRecaptureTrail('tab_activation_failed', 'failed', message, tabId);
    panel.setInsertionTargetStatus({
      status: 'unavailable',
      message,
      trail,
    });
    return { ok: false, message };
  }
}

function appendRecaptureTrail(
  event: RecaptureStatusTrailEvent,
  level: RecaptureStatusTrailLevel,
  message: string,
  tabId?: number,
): RecaptureStatusTrailItem[] {
  recaptureTrail = [
    ...recaptureTrail,
    {
      event,
      level,
      message,
      tabId,
      at: new Date().toISOString(),
    },
  ].slice(-MAX_RECAPTURE_TRAIL_ITEMS);
  return recaptureTrail;
}

function trailEventForRecapture(response: RecaptureInsertionTargetResult): RecaptureStatusTrailEvent {
  if (response.outcome === 'recapture_succeeded') {
    return 'recapture_succeeded';
  }

  if (response.outcome === 'needs_focused_compose_target' || response.outcome === 'tab_choice_acknowledged') {
    return 'focus_required';
  }

  return 'recapture_failed';
}

function trailLevelForRecapture(response: RecaptureInsertionTargetResult): RecaptureStatusTrailLevel {
  if (response.outcome === 'recapture_succeeded') {
    return 'success';
  }

  if (response.outcome === 'needs_focused_compose_target' || response.outcome === 'tab_choice_acknowledged') {
    return 'warning';
  }

  return 'failed';
}

function insertionTargetMessage(session: WorkspaceSession): string {
  const status = session.insertionTargetStatus ?? (session.insertionTarget ? 'stale' : 'needs_recapture');

  if (status === 'live') {
    return 'Target available';
  }

  if (status === 'stale') {
    return 'Target stale; Draftlet will recheck before inserting.';
  }

  if (status === 'unavailable') {
    return 'Target unavailable; Copy still works.';
  }

  if (status === 'needs_focus') {
    return 'Focus a compose field in the selected tab, then retry recapture.';
  }

  if (status === 'tab_disambiguation_required') {
    return 'Choose the tab with the compose field, then recapture.';
  }

  return 'Focus a compose field and recapture to enable insertion.';
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
