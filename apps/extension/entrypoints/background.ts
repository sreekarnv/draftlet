import {
  checkServerHealth,
  getWorkspaceSessionSnapshot,
  patchTurnStatus,
  putConversationThread,
  putTurn,
  putWorkspaceSession,
  streamReplies,
} from '../core/api';
import { DEFAULT_TONE } from '../core/constants';
import {
  CANCEL_DRAFT_GENERATION,
  CONVERSATION_THREAD_UPDATED,
  DRAFT_GENERATION_COMPLETED,
  DRAFT_GENERATION_FAILED,
  DRAFT_GENERATION_STARTED,
  DRAFT_VARIANT_RECEIVED,
  GET_CURRENT_WORKSPACE_SESSION,
  GET_RUNTIME_STATUS,
  INSERT_REPLY,
  LAUNCH_SIDE_PANEL,
  START_DRAFT_GENERATION,
  WORKSPACE_SESSION_UPDATED,
  type CancelDraftGenerationResult,
  type ConversationThreadSnapshot,
  type ConversationThread,
  type DraftVariant,
  type DraftletError,
  type DraftletMessage,
  type DraftletSidePanelContext,
  type InsertReplyResult,
  type LaunchSidePanelResult,
  type RuntimeStatusResult,
  type StartDraftGenerationResult,
  type Turn,
  type WorkspaceSession,
  type WorkspaceSessionResult,
} from '../core/messages';
import { createConversationThreadStore } from '../core/conversation-thread';
import { createWorkspaceSessionStore } from '../core/workspace-session';
import type { Tone } from '../core/types';

interface ActiveGenerationController {
  generationId: string;
  threadId: string;
  turnId: string;
  variants: DraftVariant[];
  controller: AbortController;
}

const sessions = createWorkspaceSessionStore();
const threads = createConversationThreadStore();
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

  void persistWorkspaceSession(session).then((persisted) => {
    if (persisted) {
      emitWorkspaceSessionUpdated(persisted);
    }
  });

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

  const session = sessions.getByTabId(resolvedTabId);

  if (!session) {
    return { session: null };
  }

  const restored = await restoreRuntimeSnapshot(session);
  return {
    session: restored.session,
    thread: restored.thread,
  };
}

async function handleGetRuntimeStatus(): Promise<RuntimeStatusResult> {
  const connected = await checkServerHealth();
  return { status: connected ? 'connected' : 'disconnected' };
}

async function handleStartDraftGeneration(
  sessionId: string,
  options: Pick<DraftletSidePanelContext, 'tone' | 'activeView'>,
): Promise<StartDraftGenerationResult> {
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

  const tone = options.tone ?? session.latestContext.tone ?? DEFAULT_TONE;
  const context = {
    ...session.latestContext,
    selectedText,
    tone,
    activeView: options.activeView ?? session.latestContext.activeView,
  };
  let updatedSession = sessions.updateContext(sessionId, context) ?? session;
  const threadSnapshot = threads.ensureThreadForSession({
    sessionId,
    activeThreadId: updatedSession.activeThreadId,
    context,
  });
  updatedSession = sessions.setActiveThread(sessionId, threadSnapshot.thread.threadId) ?? updatedSession;

  const turnResult = threads.createTurn({
    threadId: threadSnapshot.thread.threadId,
    context,
    tone: context.tone ?? DEFAULT_TONE,
  });

  if (!turnResult) {
    return {
      started: false,
      sessionId,
      error: createDraftletError('thread_not_found', 'Draftlet thread was not found for this session.', true, sessionId),
    };
  }

  const generationId = createGenerationId();
  const controller = new AbortController();
  const thread = turnResult.snapshot.thread;
  const turn = turnResult.turn;

  try {
    await putWorkspaceSession(updatedSession);
    await putConversationThread(thread);
    await putTurn(turn);
  } catch (error) {
    return {
      started: false,
      sessionId,
      threadId: thread.threadId,
      turnId: turn.turnId,
      error: createDraftletError(
        'runtime_persistence_failed',
        error instanceof Error ? error.message : 'Could not persist Draftlet session state.',
        true,
        generationId,
      ),
    };
  }

  activeGenerationsBySessionId.set(sessionId, {
    generationId,
    threadId: thread.threadId,
    turnId: turn.turnId,
    variants: [],
    controller,
  });
  const generatingSession = sessions.setActiveGeneration(sessionId, {
    generationId,
    threadId: thread.threadId,
    turnId: turn.turnId,
    status: 'starting',
    startedAt: new Date().toISOString(),
  }) ?? updatedSession;

  void emitWorkspaceSessionUpdated(generatingSession);
  void emitConversationThreadUpdated(sessionId, turnResult.snapshot);
  void runDraftGeneration(generatingSession.sessionId, context, generationId, thread, turn, controller);

  return {
    started: true,
    sessionId,
    generationId,
    threadId: thread.threadId,
    turnId: turn.turnId,
  };
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
  const snapshot = threads.updateTurnStatus(activeGeneration.turnId, 'cancelled');

  void patchTurnStatus(activeGeneration.turnId, 'cancelled').catch(() => {});

  if (updatedSession) {
    void emitWorkspaceSessionUpdated(updatedSession);
  }

  if (snapshot) {
    void emitConversationThreadUpdated(session.sessionId, snapshot);
  }

  return { canceled: true };
}

async function runDraftGeneration(
  sessionId: string,
  context: DraftletSidePanelContext,
  generationId: string,
  thread: ConversationThread,
  turn: Turn,
  controller: AbortController,
): Promise<void> {
  await Promise.resolve();

  if (!isActiveGeneration(sessionId, generationId)) {
    return;
  }

  const streamingSession = sessions.updateActiveGenerationStatus(sessionId, generationId, 'streaming');
  const streamingSnapshot = threads.updateTurnStatus(turn.turnId, 'streaming');
  const streamingTurn = streamingSnapshot ? findTurn(streamingSnapshot, turn.turnId) : null;

  if (streamingSession) {
    void emitWorkspaceSessionUpdated(streamingSession);
  }

  if (streamingSnapshot) {
    void emitConversationThreadUpdated(sessionId, streamingSnapshot);
  }

  await emitDraftletMessage({
    type: DRAFT_GENERATION_STARTED,
    sessionId,
    generationId,
    thread: streamingSnapshot?.thread ?? thread,
    turn: streamingTurn ?? { ...turn, generationStatus: 'streaming' },
  });

  try {
    const connected = await checkServerHealth(controller.signal);

    if (!connected) {
      await emitGenerationFailed(
        sessionId,
        generationId,
        thread.threadId,
        turn.turnId,
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
        page_title: context.pageTitle,
        session_id: sessionId,
        thread_id: thread.threadId,
        turn_id: turn.turnId,
        instruction: turn.instruction,
      },
      {
        signal: controller.signal,
        onReply(reply) {
          const active = activeGenerationsBySessionId.get(sessionId);

          if (!active || active.generationId !== generationId) {
            return;
          }

          const variantResult = threads.addVariant({
            turnId: turn.turnId,
            tone: context.tone ?? DEFAULT_TONE,
            content: reply.text,
            persistedReplyId: reply.replyId,
          });

          if (!variantResult) {
            return;
          }

          void emitConversationThreadUpdated(sessionId, variantResult.snapshot);
          active.variants.push(variantResult.variant);

          void emitDraftletMessage({
            type: DRAFT_VARIANT_RECEIVED,
            sessionId,
            generationId,
            variant: variantResult.variant,
          });
        },
      },
    );

    const active = activeGenerationsBySessionId.get(sessionId);

    if (!active || active.generationId !== generationId) {
      return;
    }

    const completedSnapshot = threads.updateTurnStatus(turn.turnId, 'completed');
    const completedTurn = completedSnapshot ? findTurn(completedSnapshot, turn.turnId) : null;

    if (completedSnapshot) {
      void emitConversationThreadUpdated(sessionId, completedSnapshot);
    }

    await emitDraftletMessage({
      type: DRAFT_GENERATION_COMPLETED,
      sessionId,
      generationId,
      thread: completedSnapshot?.thread ?? thread,
      turn: completedTurn ?? { ...turn, generationStatus: 'completed' },
      variants: completedSnapshot ? findVariantsForTurn(completedSnapshot, turn.turnId) : active.variants,
    });

  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }

    await emitGenerationFailed(
      sessionId,
      generationId,
      thread.threadId,
      turn.turnId,
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
        void persistWorkspaceSession(updatedSession);
      }
    }
  }
}

async function emitGenerationFailed(
  sessionId: string,
  generationId: string,
  threadId: string,
  turnId: string,
  error: DraftletError,
): Promise<void> {
  if (!isActiveGeneration(sessionId, generationId)) {
    return;
  }

  const failedSnapshot = threads.updateTurnStatus(turnId, 'failed');

  if (failedSnapshot) {
    void emitConversationThreadUpdated(sessionId, failedSnapshot);
  }

  await emitDraftletMessage({
    type: DRAFT_GENERATION_FAILED,
    sessionId,
    generationId,
    threadId,
    turnId,
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

async function restoreRuntimeSnapshot(session: WorkspaceSession): Promise<WorkspaceSessionResult> {
  try {
    const snapshot = await getWorkspaceSessionSnapshot(session.sessionId);

    if (!snapshot) {
      return { session };
    }

    const restoredSession = {
      ...snapshot.session,
      tabId: session.tabId,
      windowId: session.windowId,
      latestContext: {
        ...snapshot.session.latestContext,
        tabId: session.tabId,
        windowId: session.windowId,
        tone: session.latestContext.tone,
        activeView: session.latestContext.activeView,
      },
    };
    sessions.updateContext(restoredSession.sessionId, restoredSession.latestContext);

    if (restoredSession.activeThreadId) {
      sessions.setActiveThread(restoredSession.sessionId, restoredSession.activeThreadId);
    }

    if (snapshot.thread) {
      void emitConversationThreadUpdated(restoredSession.sessionId, snapshot.thread);
    }

    return { session: restoredSession, thread: snapshot.thread };
  } catch {
    return { session };
  }
}

async function persistWorkspaceSession(session: WorkspaceSession): Promise<WorkspaceSession | null> {
  try {
    return await putWorkspaceSession(session);
  } catch {
    return null;
  }
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

function emitConversationThreadUpdated(sessionId: string, snapshot: ConversationThreadSnapshot): Promise<unknown> {
  return emitDraftletMessage({
    type: CONVERSATION_THREAD_UPDATED,
    sessionId,
    snapshot,
  });
}

function emitDraftletMessage(message: DraftletMessage): Promise<unknown> {
  return browser.runtime.sendMessage(message).catch(() => {});
}

function findTurn(snapshot: ConversationThreadSnapshot, turnId: string): Turn | null {
  return snapshot.turns.find((turn) => turn.turnId === turnId) ?? null;
}

function findVariantsForTurn(snapshot: ConversationThreadSnapshot, turnId: string) {
  return snapshot.variants.filter((variant) => variant.turnId === turnId);
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
  return createDomainId('generation');
}

function createDomainId(prefix: string): string {
  if (typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
