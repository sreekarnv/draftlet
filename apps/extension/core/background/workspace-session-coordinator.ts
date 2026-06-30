import { getConversationThreadSnapshot, getDomainHistory, getWorkspaceSessionSnapshot, putWorkspaceSession } from '../runtime-api';
import { buildWorkspaceRestoreState } from '../restore-conflict';
import type {
  CreateCommandSurfaceSessionResult,
  DomainHistoryResult,
  DraftletSidePanelContext,
  DraftletError,
  LaunchSidePanelResult,
  RestoreDomainThreadResult,
  WorkspaceSession,
  WorkspaceSessionResult,
} from '../messages';
import { sessions, threads } from './state';
import {
  createDraftletError,
  emitWorkspaceSessionUpdated,
  emitConversationThreadUpdated,
  getActiveTabId,
  latestGenerationTurn,
  recordRestoreStateDiagnostic,
} from './shared-helpers';
import { restoreRuntimeSnapshot } from './restore-recovery-coordinator';
import { handleCancelDraftGeneration } from './generation-coordinator';

export async function handleLaunchSidePanel(
  context: DraftletSidePanelContext,
  sender: Browser.runtime.MessageSender,
): Promise<LaunchSidePanelResult> {
  const result = await upsertPageWorkspaceSession(context, sender);

  if (!result.session) {
    return {
      opened: false,
      message: result.error?.message ?? 'No active tab for Draftlet session.',
    };
  }

  const { session } = result;

  try {
    await openSidePanel(session);
    void emitWorkspaceSessionUpdated(session);

    return { opened: true, session };
  } catch (error) {
    return {
      opened: false,
      session,
      message: error instanceof Error ? error.message : 'Could not open side panel.',
    };
  }
}

export async function handleCreateCommandSurfaceSession(
  context: DraftletSidePanelContext,
  sender: Browser.runtime.MessageSender,
): Promise<CreateCommandSurfaceSessionResult> {
  const result = await upsertPageWorkspaceSession(context, sender);

  if (!result.session) {
    return {
      created: false,
      error: result.error,
    };
  }

  void emitWorkspaceSessionUpdated(result.session);
  return { created: true, session: result.session };
}

export async function handleGetCurrentWorkspaceSession(tabId?: number): Promise<WorkspaceSessionResult> {
  const resolvedTabId = tabId ?? await getActiveTabId();

  if (typeof resolvedTabId !== 'number') {
    return { session: null };
  }

  const session = sessions.getByTabId(resolvedTabId);

  if (!session) {
    return { session: null };
  }

  const restored = await restoreRuntimeSnapshot(session);
  return {
    session: restored.session,
    thread: restored.thread,
    restoreState: restored.restoreState,
  };
}

export async function handleGetDomainHistory(limit = 20): Promise<DomainHistoryResult> {
  try {
    return { items: await getDomainHistory(limit) };
  } catch (error) {
    return {
      items: [],
      error: createDraftletError(
        'domain_history_unavailable',
        error instanceof Error ? error.message : 'Could not load Draftlet history.',
        true,
      ),
    };
  }
}

export async function handleRestoreDomainThread(sessionId: string, threadId: string): Promise<RestoreDomainThreadResult> {
  try {
    const [sessionSnapshot, threadSnapshot] = await Promise.all([
      getWorkspaceSessionSnapshot(sessionId),
      getConversationThreadSnapshot(threadId),
    ]);

    if (!sessionSnapshot?.session || !threadSnapshot) {
      return {
        restored: false,
        error: createDraftletError('domain_thread_not_found', 'Draftlet thread was not found in history.', true, threadId),
      };
    }

    const previous = sessions.getBySessionId(sessionId);
    const activeTurn = latestGenerationTurn(threadSnapshot);
    let restoredSession: WorkspaceSession = {
      ...sessionSnapshot.session,
      tabId: previous?.tabId ?? sessionSnapshot.session.tabId,
      windowId: previous?.windowId ?? sessionSnapshot.session.windowId,
      insertionTargetStatus: 'stale',
      activeThreadId: threadId,
      activeTurnId: activeTurn?.turnId ?? sessionSnapshot.session.activeTurnId,
      activeRunId: undefined,
      latestContext: {
        selectedText: threadSnapshot.thread.source.selectedText,
        sourceUrl: threadSnapshot.thread.source.sourceUrl,
        sourceDomain: threadSnapshot.thread.source.sourceDomain,
        pageTitle: threadSnapshot.thread.source.pageTitle,
        tabId: previous?.tabId ?? sessionSnapshot.session.tabId,
        windowId: previous?.windowId ?? sessionSnapshot.session.windowId,
        tone: previous?.latestContext.tone ?? sessionSnapshot.session.latestContext.tone,
        activeView: 'replies',
        composeTarget: previous?.insertionTarget ?? sessionSnapshot.session.insertionTarget,
      },
    };
    const restoreState = buildWorkspaceRestoreState({
      session: restoredSession,
      thread: threadSnapshot,
      source: 'history',
    });
    recordRestoreStateDiagnostic(restoredSession, restoreState);
    restoredSession = {
      ...restoredSession,
      restoreState,
    };
    sessions.hydrateSession(restoredSession);
    threads.hydrateSnapshot(threadSnapshot);
    void persistWorkspaceSession(restoredSession);
    void emitWorkspaceSessionUpdated(restoredSession);
    void emitConversationThreadUpdated(restoredSession.sessionId, threadSnapshot);

    return {
      restored: true,
      session: restoredSession,
      thread: threadSnapshot,
      restoreState,
    };
  } catch (error) {
    return {
      restored: false,
      error: createDraftletError(
        'domain_thread_restore_failed',
        error instanceof Error ? error.message : 'Could not restore this Draftlet thread.',
        true,
        threadId,
      ),
    };
  }
}

export async function openSidePanel(session: WorkspaceSession) {
  if (!browser.sidePanel?.open) {
    throw new Error('Chrome side panel is not available.');
  }

  await browser.sidePanel.open({ tabId: session.tabId });
}

export async function persistWorkspaceSession(session: WorkspaceSession): Promise<WorkspaceSession | null> {
  try {
    return await putWorkspaceSession(session);
  } catch {
    return null;
  }
}

async function upsertPageWorkspaceSession(
  context: DraftletSidePanelContext,
  sender: Browser.runtime.MessageSender,
): Promise<{ session: WorkspaceSession; error?: undefined } | { session?: undefined; error: DraftletError }> {
  const tabId = sender.tab?.id ?? context.tabId;

  if (typeof tabId !== 'number') {
    return {
      error: createDraftletError('tab_not_found', 'No active tab for Draftlet session.', true),
    };
  }

  const previousSession = sessions.getByTabId(tabId);
  let session = sessions.upsertFromPageContext({
    context,
    tabId,
    windowId: sender.tab?.windowId ?? context.windowId,
  });

  const previousGenerationId = previousSession?.activeRunId;
  if (previousSession && previousGenerationId) {
    void handleCancelDraftGeneration(previousSession.sessionId, previousGenerationId);
    session = sessions.getBySessionId(session.sessionId) ?? session;
  }

  void persistWorkspaceSession(session).then((persisted) => {
    if (persisted) {
      emitWorkspaceSessionUpdated(persisted);
    }
  });

  return { session };
}
