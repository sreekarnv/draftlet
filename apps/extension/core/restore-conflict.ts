import type {
  ConversationThreadSnapshot,
  WorkspaceRecoveryAction,
  WorkspaceRestoreIssue,
  WorkspaceRestoreSource,
  WorkspaceRestoreState,
  WorkspaceSession,
} from './messages';
import type { InsertionTargetStatus } from './types';

interface BuildWorkspaceRestoreStateInput {
  session: WorkspaceSession;
  thread?: ConversationThreadSnapshot | null;
  source: WorkspaceRestoreSource;
}

export function buildWorkspaceRestoreState({
  session,
  thread,
  source,
}: BuildWorkspaceRestoreStateInput): WorkspaceRestoreState {
  const issues: WorkspaceRestoreIssue[] = [];
  const restoredSession = source === 'current_tab' || source === 'history';
  const restoredThread = Boolean(thread);
  const targetStatus = getTargetStatus(session);
  const candidateCount = session.plausibleTabs?.length ?? 0;
  const recoverableRun = thread?.latestRecoverableRun?.recoverable ? thread.latestRecoverableRun : undefined;

  if (restoredSession) {
    issues.push({
      code: 'restored_session',
      severity: 'info',
      message: source === 'history'
        ? 'Restored a saved Draftlet session from history.'
        : 'Restored the active Draftlet session for this tab.',
    });
  }

  if (restoredThread) {
    issues.push({
      code: 'restored_thread',
      severity: 'info',
      message: 'Restored the saved conversation thread.',
      threadId: thread?.thread.threadId,
    });
  }

  if (thread && session.activeThreadId && session.activeThreadId !== thread.thread.threadId) {
    issues.push({
      code: 'active_context_mismatch',
      severity: 'error',
      message: 'The restored thread differs from the session active thread. Reopen the thread or choose it from History.',
      threadId: thread.thread.threadId,
    });
  }

  if (thread && session.activeTurnId && !thread.turns.some((turn) => turn.turnId === session.activeTurnId)) {
    issues.push({
      code: 'active_context_mismatch',
      severity: 'error',
      message: 'The session active turn is not in the restored thread. Reopen the thread before retrying generation.',
      threadId: thread.thread.threadId,
      turnId: session.activeTurnId,
    });
  }

  if (session.activeRunId) {
    issues.push({
      code: 'active_run_restored',
      severity: 'info',
      message: 'Reattached to an active runtime run and replaying durable progress.',
      action: {
        kind: 'wait_for_active_run',
        label: 'Reattached',
        message: 'Draftlet is following durable run progress; it is not resuming model tokens mid-stream.',
      },
      runId: session.activeRunId,
      threadId: session.activeThreadId,
      turnId: session.activeTurnId,
    });
  }

  appendTargetIssue(issues, targetStatus, candidateCount);

  if (recoverableRun) {
    issues.push({
      code: 'interrupted_run_retryable',
      severity: 'warning',
      message: 'The latest run was interrupted but can be retried from this thread.',
      action: {
        kind: 'retry_interrupted_run',
        label: 'Retry from thread',
        message: 'Start a new run from the restored thread.',
        turnId: recoverableRun.turnId,
      },
      runId: recoverableRun.runId,
      turnId: recoverableRun.turnId,
    });
  }

  const primaryIssue = choosePrimaryIssue(issues);
  const status = statusForIssues(issues);

  return {
    source,
    status,
    summary: summaryForState(source, status, primaryIssue, restoredThread),
    primaryAction: primaryIssue?.action,
    issues,
    restoredSession,
    restoredThread,
    activeThreadId: session.activeThreadId,
    activeTurnId: session.activeTurnId,
    activeRunId: session.activeRunId,
  };
}

export function attachWorkspaceRestoreState(
  session: WorkspaceSession,
  thread: ConversationThreadSnapshot | null | undefined,
  source: WorkspaceRestoreSource,
): WorkspaceSession {
  const restoreState = buildWorkspaceRestoreState({ session, thread, source });
  return {
    ...session,
    restoreState,
  };
}

function getTargetStatus(session: WorkspaceSession): InsertionTargetStatus {
  return session.insertionTargetStatus ?? (session.insertionTarget ? 'stale' : 'needs_recapture');
}

function appendTargetIssue(
  issues: WorkspaceRestoreIssue[],
  targetStatus: InsertionTargetStatus,
  candidateCount: number,
): void {
  if (targetStatus === 'live') {
    return;
  }

  if (targetStatus === 'tab_disambiguation_required') {
    issues.push({
      code: 'tab_choice_required',
      severity: 'warning',
      message: candidateCount > 1
        ? `Choose which of ${candidateCount} plausible tabs has the compose field.`
        : 'Choose the tab with the compose field.',
      action: {
        kind: 'choose_tab',
        label: 'Choose tab',
        message: 'Choose the matching tab before recapturing the compose field.',
      },
      candidateCount,
    });
    return;
  }

  if (targetStatus === 'needs_focus') {
    issues.push({
      code: 'target_needs_focus',
      severity: 'warning',
      message: 'The compose field needs focus before Draftlet can recapture it.',
      action: {
        kind: 'recapture_target',
        label: 'Retry recapture',
        message: 'Focus the compose field, then retry recapture.',
      },
    });
    return;
  }

  if (targetStatus === 'stale') {
    issues.push({
      code: 'target_stale',
      severity: 'warning',
      message: 'The saved compose target is stale after restore.',
      action: {
        kind: 'recapture_target',
        label: 'Recapture',
        message: 'Recapture the compose field before inserting.',
      },
    });
    return;
  }

  if (targetStatus === 'unavailable') {
    issues.push({
      code: 'target_unavailable',
      severity: 'warning',
      message: 'The original compose target is unavailable. Copy still works.',
      action: {
        kind: 'copy_fallback',
        label: 'Use Copy',
        message: 'Use Copy or reopen the original page and recapture.',
      },
    });
    return;
  }

  issues.push({
    code: 'target_needs_recapture',
    severity: 'warning',
    message: 'Insertion needs a recaptured compose target.',
    action: {
      kind: 'recapture_target',
      label: 'Recapture',
      message: 'Focus a compose field and recapture before inserting.',
    },
  });
}

function choosePrimaryIssue(issues: WorkspaceRestoreIssue[]): WorkspaceRestoreIssue | undefined {
  const precedence: WorkspaceRestoreIssue['code'][] = [
    'active_context_mismatch',
    'tab_choice_required',
    'target_needs_focus',
    'target_stale',
    'target_needs_recapture',
    'target_unavailable',
    'active_run_restored',
    'interrupted_run_retryable',
  ];

  return precedence
    .map((code) => issues.find((issue) => issue.code === code))
    .find((issue): issue is WorkspaceRestoreIssue => Boolean(issue));
}

function statusForIssues(issues: WorkspaceRestoreIssue[]): WorkspaceRestoreState['status'] {
  if (issues.some((issue) => issue.code === 'active_context_mismatch')) {
    return 'conflict';
  }

  if (issues.some((issue) => issue.severity === 'warning' || issue.severity === 'error')) {
    return 'needs_action';
  }

  if (issues.some((issue) => issue.code === 'restored_session' || issue.code === 'restored_thread')) {
    return 'restored';
  }

  return 'ready';
}

function summaryForState(
  source: WorkspaceRestoreSource,
  status: WorkspaceRestoreState['status'],
  primaryIssue: WorkspaceRestoreIssue | undefined,
  restoredThread: boolean,
): string {
  if (status === 'conflict') {
    return primaryIssue?.message ?? 'Restore has conflicting active context.';
  }

  if (primaryIssue?.code === 'tab_choice_required') {
    return 'Restored session needs a tab choice before recapture.';
  }

  if (
    primaryIssue?.code === 'target_stale'
    || primaryIssue?.code === 'target_needs_focus'
    || primaryIssue?.code === 'target_needs_recapture'
    || primaryIssue?.code === 'target_unavailable'
  ) {
    return 'Restored thread is ready, but insertion needs target recovery.';
  }

  if (primaryIssue?.code === 'active_run_restored') {
    return 'Reattached to active draft generation and replaying progress.';
  }

  if (primaryIssue?.code === 'interrupted_run_retryable') {
    return 'Restored interrupted run; retry starts a new run from this thread.';
  }

  if (source === 'history') {
    return restoredThread ? 'Restored saved thread.' : 'Restored saved session.';
  }

  if (source === 'current_tab') {
    return restoredThread ? 'Restored active tab thread.' : 'Restored active tab session.';
  }

  return 'Workspace is up to date.';
}
