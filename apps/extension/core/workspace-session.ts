import type {
  DraftletSidePanelContext,
  WorkspaceSession,
  WorkspaceSessionGeneration,
} from './messages';
import type { PlausibleTabCandidate } from './tab-disambiguation';
import type { ComposeTargetRef, InsertionTargetStatus } from './types';

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
  updateInsertionTarget(sessionId: string, target: ComposeTargetRef | undefined, status: InsertionTargetStatus): WorkspaceSession | null;
  updatePlausibleTabs(sessionId: string, candidates: PlausibleTabCandidate[]): WorkspaceSession | null;
  setActiveThread(sessionId: string, threadId: string, turnId?: string): WorkspaceSession | null;
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
          insertionTarget: normalizedContext.composeTarget ?? existing.insertionTarget,
          insertionTargetStatus: normalizedContext.composeTarget ? 'live' : existing.insertionTargetStatus,
          plausibleTabs: normalizedContext.composeTarget ? undefined : existing.plausibleTabs,
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
        insertionTarget: normalizedContext.composeTarget,
        insertionTargetStatus: normalizedContext.composeTarget ? 'live' : 'needs_recapture',
        plausibleTabs: undefined,
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
        insertionTarget: normalizedContext.composeTarget ?? session.insertionTarget,
        insertionTargetStatus: normalizedContext.composeTarget ? 'live' : session.insertionTargetStatus,
        plausibleTabs: normalizedContext.composeTarget ? undefined : session.plausibleTabs,
      });
    },

    updateInsertionTarget(sessionId, target, status) {
      const session = sessionsById.get(sessionId);

      if (!session) {
        return null;
      }

      const nextTarget = target ?? session.insertionTarget;

      if (
        session.insertionTargetStatus === status
        && sameComposeTargetRef(session.insertionTarget, nextTarget)
        && sameComposeTargetRef(session.latestContext.composeTarget, target ?? session.latestContext.composeTarget)
        && (status !== 'tab_disambiguation_required' || !session.plausibleTabs)
      ) {
        return null;
      }

      return touch(session, {
        insertionTarget: nextTarget,
        insertionTargetStatus: status,
        plausibleTabs: status === 'tab_disambiguation_required' ? session.plausibleTabs : undefined,
        latestContext: {
          ...session.latestContext,
          composeTarget: target ?? session.latestContext.composeTarget,
        },
      });
    },

    updatePlausibleTabs(sessionId, candidates) {
      const session = sessionsById.get(sessionId);

      if (!session) {
        return null;
      }

      if (
        session.insertionTargetStatus === 'tab_disambiguation_required'
        && samePlausibleTabCandidates(session.plausibleTabs, candidates)
      ) {
        return null;
      }

      return touch(session, {
        insertionTargetStatus: candidates.length > 0 ? 'tab_disambiguation_required' : session.insertionTargetStatus,
        plausibleTabs: candidates,
      });
    },

    setActiveThread(sessionId, threadId, turnId) {
      const session = sessionsById.get(sessionId);

      if (!session) {
        return null;
      }

      return touch(session, {
        activeThreadId: threadId,
        activeTurnId: turnId ?? session.activeTurnId,
      });
    },

    setActiveGeneration(sessionId, generation) {
      const session = sessionsById.get(sessionId);

      if (!session) {
        return null;
      }

      return touch(session, {
        activeThreadId: generation.threadId ?? session.activeThreadId,
        activeTurnId: generation.turnId ?? session.activeTurnId,
        activeRunId: generation.generationId,
        activeGeneration: generation,
      });
    },

    updateActiveGenerationStatus(sessionId, generationId, status) {
      const session = sessionsById.get(sessionId);

      if (!session || session.activeGeneration?.generationId !== generationId) {
        return null;
      }

      return touch(session, {
        activeRunId: generationId,
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
        activeRunId: session.activeRunId === generationId || !generationId ? undefined : session.activeRunId,
        updatedAt: timestamp(),
      });
    },

    findByGenerationId(generationId) {
      for (const session of sessionsById.values()) {
        if (session.activeRunId === generationId || session.activeGeneration?.generationId === generationId) {
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

function sameComposeTargetRef(left?: ComposeTargetRef, right?: ComposeTargetRef): boolean {
  if (!left || !right) {
    return left === right;
  }

  return left.targetId === right.targetId
    && left.kind === right.kind
    && left.pageUrl === right.pageUrl
    && left.origin === right.origin
    && left.pageTitle === right.pageTitle
    && left.selector === right.selector
    && left.fingerprint === right.fingerprint
    && left.label === right.label;
}

function samePlausibleTabCandidates(left: PlausibleTabCandidate[] | undefined, right: PlausibleTabCandidate[]): boolean {
  if (!left || left.length !== right.length) {
    return false;
  }

  return left.every((candidate, index) => {
    const other = right[index];
    return candidate.tabId === other.tabId
      && candidate.windowId === other.windowId
      && candidate.url === other.url
      && candidate.title === other.title
      && candidate.matchReason === other.matchReason;
  });
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
    composeTarget: context.composeTarget,
  };
}

function createSessionId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
