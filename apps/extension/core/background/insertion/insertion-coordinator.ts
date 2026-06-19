import {
  INSERT_REPLY,
  type DraftletMessage,
  type InsertReplyResult,
} from '../../messages';
import { recordRecaptureDiagnostic } from '../diagnostics-coordinator';
import { resolveInsertionSession } from '../runtime-run-state';
import {
  bindSessionToTab,
  ensureInsertionTabActive,
  resolveInsertionTab,
} from './insertion-targets';

export async function handleInsertReply(replyText: string, sessionId?: string): Promise<InsertReplyResult> {
  const session = await resolveInsertionSession(sessionId);

  if (!session) {
    return { result: { status: 'failed', message: 'No active Draftlet tab.', targetStatus: 'unavailable', errorCode: 'session_not_found' } };
  }

  const tabResolution = await resolveInsertionTab(session);

  if (tabResolution.status === 'missing') {
    recordRecaptureDiagnostic({
      event: 'tab_resolution_missing',
      level: 'warning',
      sessionId: session.sessionId,
      status: 'unavailable',
      reason: 'tab_unavailable',
      message: 'Original page is not open for insertion.',
    });

    return {
      result: {
        status: 'failed',
        message: 'Original page is not open.',
        targetStatus: 'unavailable',
        errorCode: 'target_unavailable',
      },
    };
  }

  if (tabResolution.status === 'ambiguous') {
    return {
      result: {
        status: 'failed',
        message: 'Choose the tab with the compose field before inserting.',
        targetStatus: 'tab_disambiguation_required',
        errorCode: 'tab_disambiguation_required',
      },
    };
  }

  await ensureInsertionTabActive(tabResolution.tab);
  bindSessionToTab(session, tabResolution.tab);

  return browser.tabs.sendMessage(session.tabId, {
    type: INSERT_REPLY,
    sessionId: session.sessionId,
    replyText,
    target: session.insertionTarget ?? session.latestContext.composeTarget,
  } satisfies DraftletMessage) as Promise<InsertReplyResult>;
}
