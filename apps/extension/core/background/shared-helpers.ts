import {
  CONVERSATION_THREAD_UPDATED,
  WORKSPACE_SESSION_UPDATED,
  type ConversationThreadSnapshot,
  type DraftletError,
  type DraftletMessage,
  type Turn,
  type WorkspaceRestoreIssue,
  type WorkspaceRestoreSource,
  type WorkspaceRestoreState,
  type WorkspaceSession,
} from '../messages';
import { attachWorkspaceRestoreState } from '../restore-conflict';
import { recordRecaptureDiagnostic } from './diagnostics-coordinator';
import { restoreDiagnosticKeyBySessionId, sessions, threads } from './state';

export function findTurn(snapshot: ConversationThreadSnapshot, turnId: string): Turn | null {
  return snapshot.turns.find((turn) => turn.turnId === turnId) ?? null;
}

export function latestGenerationTurn(snapshot: ConversationThreadSnapshot): Turn | null {
  return [...snapshot.turns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).at(0) ?? null;
}

export function isInProgressTurn(turn: Turn): boolean {
  return turn.generationStatus === 'queued' || turn.generationStatus === 'started' || turn.generationStatus === 'streaming';
}

export async function getActiveTab(): Promise<Browser.tabs.Tab | undefined> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab;
  } catch {
    return undefined;
  }
}

export async function getActiveTabId(): Promise<number | undefined> {
  const tab = await getActiveTab();
  return tab?.id;
}

export function emitDraftletMessage(message: DraftletMessage): Promise<unknown> {
  return browser.runtime.sendMessage(message).catch(() => {});
}

export function emitDraftletTabMessage(tabId: number | undefined, message: DraftletMessage): Promise<unknown> {
  if (typeof tabId !== 'number' || tabId < 0) {
    return Promise.resolve();
  }

  return Promise.resolve(browser.tabs.sendMessage(tabId, message)).catch(() => {});
}

export function emitWorkspaceSessionUpdated(session: WorkspaceSession): Promise<unknown> {
  return emitDraftletMessage({
    type: WORKSPACE_SESSION_UPDATED,
    session: withCurrentRestoreState(session, 'session_update'),
  });
}

export function emitConversationThreadUpdated(sessionId: string, snapshot: ConversationThreadSnapshot): Promise<unknown> {
  const message = {
    type: CONVERSATION_THREAD_UPDATED,
    sessionId,
    snapshot,
  } satisfies DraftletMessage;
  const session = sessions.getBySessionId(sessionId);

  return Promise.all([
    emitDraftletMessage(message),
    emitDraftletTabMessage(session?.tabId, message),
  ]);
}

export function createDraftletError(
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

export function createGenerationId(): string {
  return createDomainId('generation');
}

export function createDomainId(prefix: string): string {
  if (typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Every session update broadcast goes through `attachAndRecordWorkspaceRestoreState`, which
// calls `recordRestoreStateDiagnostic`. The diagnostic is deduped per session by a fingerprint
// of the restore state, so the 50-entry ring buffer in `recapture-diagnostics.ts` is bounded
// by the number of distinct restore-state fingerprints per session, not by traffic.
export function withCurrentRestoreState(session: WorkspaceSession, source: WorkspaceRestoreSource): WorkspaceSession {
  const thread = session.activeThreadId
    ? threads.getSnapshot(session.activeThreadId)
    : threads.getSnapshotForSession(session.sessionId);
  return attachAndRecordWorkspaceRestoreState(session, thread, source);
}

export function attachAndRecordWorkspaceRestoreState(
  session: WorkspaceSession,
  thread: ConversationThreadSnapshot | null | undefined,
  source: WorkspaceRestoreSource,
  recoveryIssues?: WorkspaceRestoreIssue[],
): WorkspaceSession {
  const restoredSession = attachWorkspaceRestoreState(session, thread, source, recoveryIssues);

  if (restoredSession.restoreState) {
    recordRestoreStateDiagnostic(restoredSession, restoredSession.restoreState);
  }

  return restoredSession;
}

export function recordRestoreStateDiagnostic(
  session: WorkspaceSession,
  restoreState: WorkspaceRestoreState,
): void {
  const primaryIssue = restoreState.issues.find((issue) => issue.severity === 'error' || issue.severity === 'warning')
    ?? restoreState.issues[0];
  const key = [
    restoreState.source,
    restoreState.status,
    restoreState.summary,
    restoreState.activeThreadId,
    restoreState.activeTurnId,
    restoreState.activeRunId,
    restoreState.issues.map((issue) => `${issue.code}:${issue.severity}:${issue.threadId ?? ''}:${issue.turnId ?? ''}:${issue.runId ?? ''}`).join('|'),
  ].join('::');

  if (restoreDiagnosticKeyBySessionId.get(session.sessionId) === key) {
    return;
  }

  restoreDiagnosticKeyBySessionId.set(session.sessionId, key);
  recordRecaptureDiagnostic({
    event: 'restore_state_projected',
    level: restoreState.status === 'conflict'
      ? 'error'
      : restoreState.status === 'needs_action'
        ? 'warning'
        : 'info',
    sessionId: session.sessionId,
    tabId: session.tabId >= 0 ? session.tabId : undefined,
    status: restoreState.status,
    reason: primaryIssue?.code,
    message: restoreState.summary,
  });
}
