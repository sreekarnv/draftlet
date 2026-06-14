import { INSERT_REPLY, RECAPTURE_INSERTION_TARGET, REVALIDATE_INSERTION_TARGET, type DraftletMessage, type InsertReplyResult, type InsertionTargetStatusResult, type RecaptureInsertionTargetResult, type WorkspaceSession } from '../messages';
import type { PlausibleTabCandidate } from '../tab-disambiguation';
import { findPlausibleTabCandidates, isPlausibleSessionTab } from '../tab-disambiguation';
import { sessions, type InsertionTabResolution } from './state';
import {
  createDraftletError,
  emitWorkspaceSessionUpdated,
} from './shared-helpers';
import {
  persistWorkspaceSession,
} from './workspace-session-coordinator';
import {
  reasonForInsertionTargetStatus,
  recordRecaptureDiagnostic,
} from './diagnostics-coordinator';
import { resolveInsertionSession } from './runtime-run-state';

export async function handleInsertReply(replyText: string, sessionId?: string): Promise<InsertReplyResult> {
  const session = await resolveInsertionSession(sessionId);

  if (!session) {
    return { result: { status: 'failed', message: 'No active Draftlet tab.', targetStatus: 'unavailable', errorCode: 'session_not_found' } };
  }

  const targetStatus = await revalidateInsertionTarget(session);

  if (targetStatus.status !== 'live') {
    return {
      result: {
        status: 'failed',
        message: targetStatus.message ?? 'Insertion target is not available.',
        targetStatus: targetStatus.status,
        errorCode: `target_${targetStatus.status}`,
      },
    };
  }

  return browser.tabs.sendMessage(session.tabId, {
    type: INSERT_REPLY,
    sessionId: session.sessionId,
    replyText,
    target: targetStatus.target,
  } satisfies DraftletMessage) as Promise<InsertReplyResult>;
}

export async function handleGetInsertionTargetStatus(sessionId?: string): Promise<InsertionTargetStatusResult> {
  const session = await resolveInsertionSession(sessionId);

  if (!session) {
    return { status: 'unavailable', message: 'No active Draftlet session.' };
  }

  return revalidateInsertionTarget(session);
}

export async function handleRecaptureInsertionTarget(sessionId: string, tabId?: number): Promise<RecaptureInsertionTargetResult> {
  const session = sessions.getBySessionId(sessionId);

  if (!session) {
    return {
      recaptured: false,
      status: 'unavailable',
      outcome: 'recapture_failed',
      reason: 'session_not_found',
      message: 'No active Draftlet session.',
    };
  }

  recordRecaptureDiagnostic({
    event: 'recapture_requested',
    level: 'info',
    sessionId,
    tabId,
    message: tabId ? 'Recapture requested for selected tab.' : 'Recapture requested.',
  });

  const tabResolution = await resolveRecaptureTab(session, tabId);

  if (tabResolution.status === 'ambiguous') {
    const updated = sessions.updatePlausibleTabs(session.sessionId, tabResolution.candidates);

    if (updated) {
      void emitWorkspaceSessionUpdated(updated);
    }

    recordRecaptureDiagnostic({
      event: 'tab_resolution_ambiguous',
      level: 'warning',
      sessionId,
      status: 'tab_disambiguation_required',
      reason: 'tab_disambiguation_required',
      message: `Recapture found ${tabResolution.candidates.length} plausible tabs.`,
    });

    return {
      recaptured: false,
      status: 'tab_disambiguation_required',
      outcome: 'recapture_failed',
      target: session.insertionTarget,
      candidates: tabResolution.candidates,
      reason: 'tab_disambiguation_required',
      message: 'Choose the tab with the compose field before recapturing.',
    };
  }

  const recaptureTabId = tabResolution.status === 'resolved' ? tabResolution.tab.id : undefined;
  const selectedTab = tabResolution.status === 'resolved'
    ? findPlausibleTabCandidates([tabResolution.tab], session)[0]
    : undefined;

  if (tabResolution.status === 'missing' || typeof recaptureTabId !== 'number') {
    const updated = sessions.updateInsertionTarget(session.sessionId, session.insertionTarget, 'unavailable');

    if (updated) {
      void emitWorkspaceSessionUpdated(updated);
    }

    recordRecaptureDiagnostic({
      event: 'tab_resolution_missing',
      level: 'warning',
      sessionId,
      tabId,
      status: 'unavailable',
      reason: 'tab_unavailable',
      message: tabId ? 'Selected recapture tab is unavailable.' : 'No plausible recapture tab is available.',
    });

    return {
      recaptured: false,
      status: 'unavailable',
      outcome: 'chosen_tab_unavailable',
      target: session.insertionTarget,
      reason: 'tab_unavailable',
      message: tabId
        ? 'That tab is no longer available. Choose another tab or use Copy.'
        : 'Open the page with the compose field, focus it, and try again.',
    };
  }

  const target = session.insertionTarget ?? session.latestContext.composeTarget;

  try {
    recordRecaptureDiagnostic({
      event: 'content_recapture_requested',
      level: 'debug',
      sessionId,
      tabId: recaptureTabId,
      message: 'Sent recapture request to content script.',
    });
    const result = await browser.tabs.sendMessage(recaptureTabId, {
      type: RECAPTURE_INSERTION_TARGET,
      sessionId,
      target,
    } satisfies DraftletMessage) as RecaptureInsertionTargetResult;
    const normalizedResult = normalizeRecaptureResult(result, selectedTab, Boolean(tabId));
    const updated = sessions.updateInsertionTarget(
      session.sessionId,
      normalizedResult.target ?? target,
      normalizedResult.status,
    );

    if (updated) {
      void emitWorkspaceSessionUpdated(updated);
      if (normalizedResult.recaptured) {
        void persistWorkspaceSession(updated);
      }
    }

    recordRecaptureDiagnostic({
      event: 'content_recapture_completed',
      level: normalizedResult.recaptured ? 'info' : normalizedResult.status === 'needs_focus' ? 'warning' : 'error',
      sessionId,
      tabId: recaptureTabId,
      status: normalizedResult.status,
      outcome: normalizedResult.outcome,
      reason: normalizedResult.reason,
      message: normalizedResult.message,
    });

    return normalizedResult;
  } catch {
    const updated = sessions.updateInsertionTarget(session.sessionId, session.insertionTarget, 'unavailable');

    if (updated) {
      void emitWorkspaceSessionUpdated(updated);
    }

    recordRecaptureDiagnostic({
      event: 'content_recapture_failed',
      level: 'error',
      sessionId,
      tabId: recaptureTabId,
      status: 'unavailable',
      outcome: 'recapture_failed',
      reason: 'content_script_unavailable',
      message: 'Content script was unavailable during recapture.',
    });

    return {
      recaptured: false,
      status: 'unavailable',
      outcome: 'recapture_failed',
      target: session.insertionTarget,
      selectedTab,
      reason: 'content_script_unavailable',
      message: 'Draftlet cannot reach the page. Reload the page, focus a compose field, and try again.',
    };
  }
}

export async function handleActivateRecaptureTab(sessionId: string, tabId: number): Promise<{ activated: boolean; tab?: PlausibleTabCandidate; error?: ReturnType<typeof createDraftletError>; message: string }> {
  const session = sessions.getBySessionId(sessionId);

  if (!session) {
    return {
      activated: false,
      error: createDraftletError('session_not_found', 'No active Draftlet session.', true, sessionId),
      message: 'No active Draftlet session.',
    };
  }

  recordRecaptureDiagnostic({
    event: 'tab_activation_requested',
    level: 'info',
    sessionId,
    tabId,
    message: 'Tab activation requested for recapture.',
  });

  const tab = await browser.tabs.get(tabId).catch(() => null);

  if (!tab?.id || !isPlausibleSessionTab(tab, session)) {
    recordRecaptureDiagnostic({
      event: 'tab_activation_failed',
      level: 'warning',
      sessionId,
      tabId,
      reason: 'tab_unavailable',
      message: 'Selected tab is unavailable or no longer plausible for recapture.',
    });

    return {
      activated: false,
      error: createDraftletError('tab_unavailable', 'That tab is no longer available for recapture.', true, sessionId),
      message: 'That tab is no longer available. Choose another tab or use Copy.',
    };
  }

  try {
    if (typeof tab.windowId === 'number') {
      await browser.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
    }

    const activatedTab = await browser.tabs.update(tab.id, { active: true });
    const reboundTab = bindSessionToTab(session, activatedTab?.id ? activatedTab : tab);
    const candidate = findPlausibleTabCandidates([reboundTab], session)[0];

    recordRecaptureDiagnostic({
      event: 'tab_activation_completed',
      level: 'info',
      sessionId,
      tabId: tab.id,
      message: 'Selected tab activated for recapture.',
    });

    return {
      activated: true,
      tab: candidate,
      message: 'Selected tab opened. Focus the compose field there, then retry recapture.',
    };
  } catch {
    recordRecaptureDiagnostic({
      event: 'tab_activation_failed',
      level: 'error',
      sessionId,
      tabId,
      reason: 'tab_activation_failed',
      message: 'Browser rejected selected tab activation.',
    });

    return {
      activated: false,
      error: createDraftletError('tab_activation_failed', 'Draftlet could not open the selected tab.', true, sessionId),
      message: 'Draftlet could not open the selected tab. Switch to it manually, focus the compose field, then retry.',
    };
  }
}

export async function revalidateInsertionTarget(session: WorkspaceSession): Promise<InsertionTargetStatusResult> {
  recordRecaptureDiagnostic({
    event: 'target_revalidation_requested',
    level: 'debug',
    sessionId: session.sessionId,
    message: 'Insertion target revalidation requested.',
  });

  const tabResolution = await resolveInsertionTab(session);

  if (tabResolution.status === 'ambiguous') {
    const updated = sessions.updatePlausibleTabs(session.sessionId, tabResolution.candidates);

    if (updated) {
      void emitWorkspaceSessionUpdated(updated);
    }

    recordRecaptureDiagnostic({
      event: 'target_revalidation_completed',
      level: 'warning',
      sessionId: session.sessionId,
      status: 'tab_disambiguation_required',
      reason: 'tab_disambiguation_required',
      message: `Revalidation found ${tabResolution.candidates.length} plausible tabs.`,
    });

    return {
      status: 'tab_disambiguation_required',
      target: session.insertionTarget,
      candidates: tabResolution.candidates,
      message: 'Choose the tab with the compose field before recapturing.',
    };
  }

  const revalidationTabId = tabResolution.status === 'resolved' ? tabResolution.tab.id : undefined;

  if (tabResolution.status === 'missing' || typeof revalidationTabId !== 'number') {
    const updated = sessions.updateInsertionTarget(session.sessionId, session.insertionTarget, 'unavailable');

    if (updated) {
      void emitWorkspaceSessionUpdated(updated);
    }

    recordRecaptureDiagnostic({
      event: 'target_revalidation_completed',
      level: 'warning',
      sessionId: session.sessionId,
      tabId: revalidationTabId,
      status: 'unavailable',
      reason: 'tab_unavailable',
      message: 'Original page is not open.',
    });

    return { status: 'unavailable', target: session.insertionTarget, message: 'Original page is not open.' };
  }

  const target = session.insertionTarget ?? session.latestContext.composeTarget;

  try {
    const result = await browser.tabs.sendMessage(revalidationTabId, {
      type: REVALIDATE_INSERTION_TARGET,
      sessionId: session.sessionId,
      target,
    } satisfies DraftletMessage) as InsertionTargetStatusResult;
    const updated = sessions.updateInsertionTarget(
      session.sessionId,
      result.target ?? target,
      result.status,
    );

    if (updated) {
      void emitWorkspaceSessionUpdated(updated);
      if (result.status === 'live') {
        void persistWorkspaceSession(updated);
      }
    }

    recordRecaptureDiagnostic({
      event: 'target_revalidation_completed',
      level: result.status === 'live' ? 'info' : result.status === 'needs_recapture' || result.status === 'needs_focus' ? 'warning' : 'error',
      sessionId: session.sessionId,
      tabId: revalidationTabId,
      status: result.status,
      reason: reasonForInsertionTargetStatus(result.status),
      message: result.message ?? 'Insertion target revalidation completed.',
    });

    return result;
  } catch {
    const updated = sessions.updateInsertionTarget(session.sessionId, target, 'unavailable');

    if (updated) {
      void emitWorkspaceSessionUpdated(updated);
    }

    recordRecaptureDiagnostic({
      event: 'target_revalidation_failed',
      level: 'error',
      sessionId: session.sessionId,
      tabId: revalidationTabId,
      status: 'unavailable',
      reason: 'content_script_unavailable',
      message: 'Content script was unavailable during insertion target revalidation.',
    });

    return { status: 'unavailable', target, message: 'Draftlet cannot reach the page for insertion.' };
  }
}

function normalizeRecaptureResult(
  result: RecaptureInsertionTargetResult,
  selectedTab: PlausibleTabCandidate | undefined,
  fromTabChoice: boolean,
): RecaptureInsertionTargetResult {
  if (result.recaptured) {
    return {
      ...result,
      outcome: 'recapture_succeeded',
      selectedTab,
      message: 'Recaptured the compose field. Insertion is available again.',
    };
  }

  if (result.reason === 'no_focused_compose_target' || result.status === 'needs_focus') {
    return {
      ...result,
      status: 'needs_focus',
      outcome: 'needs_focused_compose_target',
      selectedTab,
      message: fromTabChoice
        ? 'Tab selected. Focus the compose field in that tab, then retry recapture.'
        : 'Focus a compose field on the page, then retry recapture.',
    };
  }

  if (result.status === 'stale') {
    return {
      ...result,
      outcome: fromTabChoice ? 'tab_choice_acknowledged' : 'recapture_failed',
      selectedTab,
      message: fromTabChoice
        ? 'Tab selected, but the saved compose field is stale. Focus the compose field, then retry recapture.'
        : result.message,
    };
  }

  return {
    ...result,
    outcome: result.outcome ?? 'recapture_failed',
    selectedTab,
  };
}

async function resolveRecaptureTab(session: WorkspaceSession, tabId?: number): Promise<InsertionTabResolution> {
  if (typeof tabId === 'number') {
    const tab = await browser.tabs.get(tabId).catch(() => null);

    if (tab?.id && isPlausibleSessionTab(tab, session)) {
      return { status: 'resolved', tab: bindSessionToTab(session, tab) };
    }

    return { status: 'missing' };
  }

  const { getActiveTab } = await import('./shared-helpers');
  const activeTab = await getActiveTab().catch(() => null);

  if (activeTab?.id && isPlausibleSessionTab(activeTab, session)) {
    return { status: 'resolved', tab: bindSessionToTab(session, activeTab) };
  }

  return resolveInsertionTab(session);
}

async function resolveInsertionTab(session: WorkspaceSession): Promise<InsertionTabResolution> {
  const shouldDisambiguate = session.insertionTargetStatus === 'stale'
    || session.insertionTargetStatus === 'tab_disambiguation_required';

  if (!shouldDisambiguate && session.tabId >= 0) {
    const tab = await browser.tabs.get(session.tabId).catch(() => null);

    if (tab && isPlausibleSessionTab(tab, session)) {
      return { status: 'resolved', tab };
    }
  }

  const tabs = await browser.tabs.query({}).catch(() => []);
  const candidates = findPlausibleTabCandidates(tabs, session);

  if (candidates.length > 1) {
    return { status: 'ambiguous', candidates };
  }

  const candidate = candidates[0];

  if (!candidate) {
    return { status: 'missing' };
  }

  const tab = tabs.find((item) => item.id === candidate.tabId);

  if (!tab?.id) {
    return { status: 'missing' };
  }

  return { status: 'resolved', tab: bindSessionToTab(session, tab) };
}

function bindSessionToTab(session: WorkspaceSession, tab: Browser.tabs.Tab): Browser.tabs.Tab {
  if (!tab.id) {
    return tab;
  }

  const updated = sessions.hydrateSession({
    ...session,
    tabId: tab.id,
    windowId: tab.windowId,
    plausibleTabs: undefined,
    latestContext: {
      ...session.latestContext,
      tabId: tab.id,
      windowId: tab.windowId,
    },
  });
  void emitWorkspaceSessionUpdated(updated);
  return tab;
}
