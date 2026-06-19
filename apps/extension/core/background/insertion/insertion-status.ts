import {
  REVALIDATE_INSERTION_TARGET,
  type DraftletMessage,
  type InsertionTargetStatusResult,
  type WorkspaceSession,
} from '../../messages';
import { sessions } from '../state';
import { reasonForInsertionTargetStatus, recordRecaptureDiagnostic } from '../diagnostics-coordinator';
import { emitWorkspaceSessionUpdated } from '../shared-helpers';
import { persistWorkspaceSession } from '../workspace-session-coordinator';
import { resolveInsertionSession } from '../runtime-run-state';
import { resolveInsertionTab } from './insertion-targets';

export async function handleGetInsertionTargetStatus(sessionId?: string): Promise<InsertionTargetStatusResult> {
  const session = await resolveInsertionSession(sessionId);

  if (!session) {
    return { status: 'unavailable', message: 'No active Draftlet session.' };
  }

  return revalidateInsertionTarget(session);
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
