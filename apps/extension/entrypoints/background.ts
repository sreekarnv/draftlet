import { checkServerHealth, streamReplies } from '../core/api';
import { DEFAULT_TONE } from '../core/constants';
import {
  CANCEL_DRAFT_GENERATION,
  DRAFT_GENERATION_COMPLETED,
  DRAFT_GENERATION_FAILED,
  DRAFT_GENERATION_STARTED,
  DRAFT_REPLY_RECEIVED,
  GET_CURRENT_WORKSPACE_SESSION,
  GET_RUNTIME_STATUS,
  INSERT_REPLY,
  LAUNCH_SIDE_PANEL,
  WORKSPACE_SESSION_UPDATED,
  START_DRAFT_GENERATION,
  type CancelDraftGenerationResult,
  type DraftletError,
  type DraftletMessage,
  type DraftletSidePanelContext,
  type InsertReplyResult,
  type LaunchSidePanelResult,
  type RuntimeStatusResult,
  type StartDraftGenerationResult,
  type WorkspaceSession,
  type WorkspaceSessionResult,
} from '../core/messages';
import { createWorkspaceSessionStore } from '../core/workspace-session';

interface ActiveGenerationController {
  generationId: string;
  controller: AbortController;
}

const sessions = createWorkspaceSessionStore();
const activeGenerationsBySessionId = new Map<string, ActiveGenerationController>();

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: DraftletMessage, sender) => {
    if (message.type === LAUNCH_SIDE_PANEL) {
      return handleLaunchSidePanel(message.context, sender);
    }

    if (message.type === GET_CURRENT_WORKSPACE_SESSION) {
      return handleGetCurrentWorkspaceSession(message.tabId);
    }

    if (message.type === GET_RUNTIME_STATUS) {
      return handleGetRuntimeStatus();
    }

    if (message.type === START_DRAFT_GENERATION) {
      return Promise.resolve(handleStartDraftGeneration(message.sessionId, {
        tone: message.tone,
        activeView: message.activeView,
      }));
    }

    if (message.type === CANCEL_DRAFT_GENERATION) {
      return Promise.resolve(handleCancelDraftGeneration(message.sessionId, message.generationId));
    }

    if (message.type === INSERT_REPLY) {
      return handleInsertReply(message.replyText, message.sessionId);
    }

    return undefined;
  });
});

async function handleLaunchSidePanel(
  context: DraftletSidePanelContext,
  sender: Browser.runtime.MessageSender,
): Promise<LaunchSidePanelResult> {
  const tabId = sender.tab?.id ?? context.tabId;

  if (typeof tabId !== 'number') {
    return {
      opened: false,
      message: 'No active tab for Draftlet session.',
    };
  }

  const previousSession = sessions.getByTabId(tabId);
  let session = sessions.upsertFromPageContext({
    context,
    tabId,
    windowId: sender.tab?.windowId ?? context.windowId,
  });

  if (previousSession?.activeGeneration) {
    handleCancelDraftGeneration(previousSession.sessionId, previousSession.activeGeneration.generationId);
    session = sessions.getBySessionId(session.sessionId) ?? session;
  }

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

async function handleGetCurrentWorkspaceSession(tabId?: number): Promise<WorkspaceSessionResult> {
  const resolvedTabId = tabId ?? await getActiveTabId();

  if (typeof resolvedTabId !== 'number') {
    return { session: null };
  }

  return { session: sessions.getByTabId(resolvedTabId) };
}

async function handleGetRuntimeStatus(): Promise<RuntimeStatusResult> {
  const connected = await checkServerHealth();
  return { status: connected ? 'connected' : 'disconnected' };
}

function handleStartDraftGeneration(
  sessionId: string,
  options: Pick<DraftletSidePanelContext, 'tone' | 'activeView'>,
): StartDraftGenerationResult {
  const session = sessions.getBySessionId(sessionId);

  if (!session) {
    return {
      started: false,
      error: createDraftletError('session_not_found', 'Draftlet session was not found for this tab.', true, sessionId),
    };
  }

  const selectedText = session.latestContext.selectedText.trim();

  if (!selectedText) {
    return {
      started: false,
      sessionId,
      error: createDraftletError('missing_context', 'Select text on a page before generating replies.', true, sessionId),
    };
  }

  handleCancelDraftGeneration(sessionId);

  const context = {
    ...session.latestContext,
    selectedText,
    tone: options.tone ?? session.latestContext.tone ?? DEFAULT_TONE,
    activeView: options.activeView ?? session.latestContext.activeView,
  };
  const updatedSession = sessions.updateContext(sessionId, context) ?? session;
  const generationId = createGenerationId();
  const controller = new AbortController();

  activeGenerationsBySessionId.set(sessionId, { generationId, controller });
  const generatingSession = sessions.setActiveGeneration(sessionId, {
    generationId,
    status: 'starting',
    startedAt: new Date().toISOString(),
  }) ?? updatedSession;

  void emitWorkspaceSessionUpdated(generatingSession);
  void runDraftGeneration(generatingSession.sessionId, context, generationId, controller);

  return { started: true, sessionId, generationId };
}

function handleCancelDraftGeneration(sessionId?: string, generationId?: string): CancelDraftGenerationResult {
  const session = resolveGenerationSession(sessionId, generationId);

  if (!session) {
    return { canceled: false };
  }

  const activeGeneration = activeGenerationsBySessionId.get(session.sessionId);

  if (!activeGeneration || (generationId && activeGeneration.generationId !== generationId)) {
    return { canceled: false };
  }

  activeGeneration.controller.abort();
  activeGenerationsBySessionId.delete(session.sessionId);
  const updatedSession = sessions.clearActiveGeneration(session.sessionId, activeGeneration.generationId);

  if (updatedSession) {
    void emitWorkspaceSessionUpdated(updatedSession);
  }

  return { canceled: true };
}

async function runDraftGeneration(
  sessionId: string,
  context: DraftletSidePanelContext,
  generationId: string,
  controller: AbortController,
): Promise<void> {
  let replyCount = 0;

  await Promise.resolve();

  if (!isActiveGeneration(sessionId, generationId)) {
    return;
  }

  const streamingSession = sessions.updateActiveGenerationStatus(sessionId, generationId, 'streaming');

  if (streamingSession) {
    void emitWorkspaceSessionUpdated(streamingSession);
  }

  await emitDraftletMessage({
    type: DRAFT_GENERATION_STARTED,
    sessionId,
    generationId,
  });

  try {
    const connected = await checkServerHealth(controller.signal);

    if (!connected) {
      await emitGenerationFailed(
        sessionId,
        generationId,
        createDraftletError('runtime_unavailable', 'Draftlet server is not reachable.', true, generationId),
      );
      return;
    }

    await streamReplies(
      {
        selected_text: context.selectedText,
        tone: context.tone ?? DEFAULT_TONE,
        source_url: context.sourceUrl,
        source_domain: context.sourceDomain,
      },
      {
        signal: controller.signal,
        onReply(reply) {
          if (!isActiveGeneration(sessionId, generationId)) {
            return;
          }

          replyCount += 1;
          void emitDraftletMessage({
            type: DRAFT_REPLY_RECEIVED,
            sessionId,
            generationId,
            reply,
          });
        },
      },
    );

    if (!isActiveGeneration(sessionId, generationId)) {
      return;
    }

    await emitDraftletMessage({
      type: DRAFT_GENERATION_COMPLETED,
      sessionId,
      generationId,
      replyCount,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }

    await emitGenerationFailed(
      sessionId,
      generationId,
      createDraftletError(
        'generation_failed',
        error instanceof Error ? error.message : 'Could not stream replies from the local server.',
        true,
        generationId,
      ),
    );
  } finally {
    if (isActiveGeneration(sessionId, generationId)) {
      activeGenerationsBySessionId.delete(sessionId);
      const updatedSession = sessions.clearActiveGeneration(sessionId, generationId);

      if (updatedSession) {
        void emitWorkspaceSessionUpdated(updatedSession);
      }
    }
  }
}

async function emitGenerationFailed(sessionId: string, generationId: string, error: DraftletError): Promise<void> {
  if (!isActiveGeneration(sessionId, generationId)) {
    return;
  }

  await emitDraftletMessage({
    type: DRAFT_GENERATION_FAILED,
    sessionId,
    generationId,
    error,
  });
}

async function handleInsertReply(replyText: string, sessionId?: string): Promise<InsertReplyResult> {
  const session = await resolveInsertionSession(sessionId);

  if (!session) {
    return { result: { status: 'failed', message: 'No active Draftlet tab.' } };
  }

  return browser.tabs.sendMessage(session.tabId, {
    type: INSERT_REPLY,
    sessionId: session.sessionId,
    replyText,
  } satisfies DraftletMessage) as Promise<InsertReplyResult>;
}

async function resolveInsertionSession(sessionId?: string): Promise<WorkspaceSession | null> {
  if (sessionId) {
    return sessions.getBySessionId(sessionId);
  }

  const tabId = await getActiveTabId();
  return typeof tabId === 'number' ? sessions.getByTabId(tabId) : null;
}

function resolveGenerationSession(sessionId?: string, generationId?: string): WorkspaceSession | null {
  if (sessionId) {
    return sessions.getBySessionId(sessionId);
  }

  if (generationId) {
    return sessions.findByGenerationId(generationId);
  }

  return null;
}

async function openSidePanel(session: WorkspaceSession) {
  if (!browser.sidePanel?.open) {
    throw new Error('Chrome side panel is not available.');
  }

  await browser.sidePanel.open({ tabId: session.tabId });
}

async function getActiveTabId(): Promise<number | undefined> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab?.id;
  } catch {
    return undefined;
  }
}

function isActiveGeneration(sessionId: string, generationId: string): boolean {
  return activeGenerationsBySessionId.get(sessionId)?.generationId === generationId;
}

function emitWorkspaceSessionUpdated(session: WorkspaceSession): Promise<unknown> {
  return emitDraftletMessage({
    type: WORKSPACE_SESSION_UPDATED,
    session,
  });
}

function emitDraftletMessage(message: DraftletMessage): Promise<unknown> {
  return browser.runtime.sendMessage(message).catch(() => {});
}

function createDraftletError(
  code: string,
  message: string,
  retryable: boolean,
  correlationId?: string,
): DraftletError {
  return {
    code,
    message,
    retryable,
    correlationId,
  };
}

function createGenerationId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `generation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
