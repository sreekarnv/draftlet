import type {
  DraftletSidePanelContext,
  WorkspaceSession,
  WorkspaceSessionGeneration,
} from './messages';

interface WorkspaceSessionStoreOptions {
  createId?: () => string;
  now?: () => Date;
}

interface UpsertWorkspaceSessionInput {
  context: DraftletSidePanelContext;
  tabId: number;
  windowId?: number;
}

export interface WorkspaceSessionStore {
  upsertFromPageContext(input: UpsertWorkspaceSessionInput): WorkspaceSession;
  hydrateSession(session: WorkspaceSession): WorkspaceSession;
  getBySessionId(sessionId: string): WorkspaceSession | null;
  getByTabId(tabId: number): WorkspaceSession | null;
  updateContext(sessionId: string, context: DraftletSidePanelContext): WorkspaceSession | null;
  setActiveThread(sessionId: string, threadId: string): WorkspaceSession | null;
  setActiveGeneration(sessionId: string, generation: WorkspaceSessionGeneration): WorkspaceSession | null;
  updateActiveGenerationStatus(
    sessionId: string,
    generationId: string,
    status: WorkspaceSessionGeneration['status'],
  ): WorkspaceSession | null;
  clearActiveGeneration(sessionId: string, generationId?: string): WorkspaceSession | null;
  findByGenerationId(generationId: string): WorkspaceSession | null;
}

export function createWorkspaceSessionStore({
  createId = createSessionId,
  now = () => new Date(),
}: WorkspaceSessionStoreOptions = {}): WorkspaceSessionStore {
  const sessionsById = new Map<string, WorkspaceSession>();
  const sessionIdByTabId = new Map<number, string>();

  const timestamp = () => now().toISOString();

  const save = (session: WorkspaceSession): WorkspaceSession => {
    sessionsById.set(session.sessionId, session);
    sessionIdByTabId.set(session.tabId, session.sessionId);
    return session;
  };

  const touch = (session: WorkspaceSession, changes: Partial<WorkspaceSession>): WorkspaceSession => save({
    ...session,
    ...changes,
    updatedAt: timestamp(),
  });

  return {
    upsertFromPageContext({ context, tabId, windowId }) {
      const existing = getSessionByTabId(tabId);
      const pageUrl = context.sourceUrl;
      const normalizedContext = normalizeContext(context, tabId, windowId);

      if (existing && existing.pageUrl === pageUrl) {
        return touch(existing, {
          windowId,
          pageUrl,
          pageTitle: normalizedContext.pageTitle,
          latestContext: normalizedContext,
          status: 'active',
        });
      }

      if (existing) {
        sessionIdByTabId.delete(existing.tabId);
      }

      const createdAt = timestamp();
      const session: WorkspaceSession = {
        sessionId: createId(),
        tabId,
        windowId,
        pageUrl,
        pageTitle: normalizedContext.pageTitle,
        latestContext: normalizedContext,
        status: 'active',
        createdAt,
        updatedAt: createdAt,
      };

      return save(session);
    },

    hydrateSession(session) {
      const previous = sessionsById.get(session.sessionId);

      if (previous && previous.tabId !== session.tabId) {
        sessionIdByTabId.delete(previous.tabId);
      }

      return save(session);
    },

    getBySessionId(sessionId) {
      return sessionsById.get(sessionId) ?? null;
    },

    getByTabId(tabId) {
      return getSessionByTabId(tabId);
    },

    updateContext(sessionId, context) {
      const session = sessionsById.get(sessionId);

      if (!session) {
        return null;
      }

      const normalizedContext = normalizeContext(context, session.tabId, session.windowId);
      return touch(session, {
        pageUrl: normalizedContext.sourceUrl,
        pageTitle: normalizedContext.pageTitle,
        latestContext: normalizedContext,
      });
    },

    setActiveThread(sessionId, threadId) {
      const session = sessionsById.get(sessionId);

      if (!session) {
        return null;
      }

      return touch(session, { activeThreadId: threadId });
    },

    setActiveGeneration(sessionId, generation) {
      const session = sessionsById.get(sessionId);

      if (!session) {
        return null;
      }

      return touch(session, { activeGeneration: generation });
    },

    updateActiveGenerationStatus(sessionId, generationId, status) {
      const session = sessionsById.get(sessionId);

      if (!session || session.activeGeneration?.generationId !== generationId) {
        return null;
      }

      return touch(session, {
        activeGeneration: {
          ...session.activeGeneration,
          status,
        },
      });
    },

    clearActiveGeneration(sessionId, generationId) {
      const session = sessionsById.get(sessionId);

      if (!session || (generationId && session.activeGeneration?.generationId !== generationId)) {
        return null;
      }

      const { activeGeneration: _activeGeneration, ...rest } = session;
      return save({
        ...rest,
        updatedAt: timestamp(),
      });
    },

    findByGenerationId(generationId) {
      for (const session of sessionsById.values()) {
        if (session.activeGeneration?.generationId === generationId) {
          return session;
        }
      }

      return null;
    },
  };

  function getSessionByTabId(tabId: number): WorkspaceSession | null {
    const sessionId = sessionIdByTabId.get(tabId);
    return sessionId ? sessionsById.get(sessionId) ?? null : null;
  }
}

function normalizeContext(
  context: DraftletSidePanelContext,
  tabId: number,
  windowId?: number,
): DraftletSidePanelContext {
  return {
    ...context,
    selectedText: context.selectedText.trim(),
    sourceUrl: context.sourceUrl,
    sourceDomain: context.sourceDomain || undefined,
    pageTitle: context.pageTitle || undefined,
    tabId,
    windowId,
  };
}

function createSessionId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
