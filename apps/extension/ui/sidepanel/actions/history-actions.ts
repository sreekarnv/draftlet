import {
  GET_DOMAIN_HISTORY,
  RESTORE_DOMAIN_THREAD,
  type DomainHistoryItem,
  type DomainHistoryResult,
  type DraftletMessage,
  type RestoreDomainThreadResult,
} from '../../../core/messages';
import type { PanelController } from '../../mount-panel';
import type { SidePanelState } from '../state';
import type { VariantActionResult } from './action-types';
import { getSendMessage } from './message-client';
import { applySession, applyThreadSnapshot } from './thread-actions';

export async function loadDomainHistory(state: SidePanelState, panel: PanelController): Promise<DomainHistoryItem[]> {
  try {
    const response = await getSendMessage()<DomainHistoryResult>({
      type: GET_DOMAIN_HISTORY,
      limit: 20,
    } satisfies DraftletMessage);

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.items;
  } catch (error) {
    panel.setConnectionStatus('disconnected');
    throw error;
  }
}

export async function restoreDomainHistoryItem(state: SidePanelState, panel: PanelController, item: DomainHistoryItem): Promise<VariantActionResult> {
  try {
    const response = await getSendMessage()<RestoreDomainThreadResult>({
      type: RESTORE_DOMAIN_THREAD,
      sessionId: item.session.sessionId,
      threadId: item.thread.thread.threadId,
    } satisfies DraftletMessage);

    if (!response.restored || !response.session || !response.thread) {
      return { ok: false, message: response.error?.message ?? 'Could not restore this thread.' };
    }

    applySession(state, panel, response.session, response.restoreState);
    applyThreadSnapshot(state, panel, response.thread);
    panel.setActiveView('replies');
    return { ok: true, message: 'Restored this thread.' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not reach the Draftlet extension coordinator.',
    };
  }
}
