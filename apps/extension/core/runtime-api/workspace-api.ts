import { SERVER_BASE_URL } from '../constants';
import type {
  DomainHistoryItem,
  WorkspaceSession,
  WorkspaceSessionSnapshot,
} from '../messages';
import { getJson, putJson } from './transport';
import {
  mapComposeTargetWrite,
  mapDomainHistoryItem,
  mapWorkspaceSession,
  mapWorkspaceSessionSnapshot,
  type WorkspaceSessionRead,
  type WorkspaceSessionSnapshotRead,
  type DomainHistoryItemRead,
} from './mappers';

export async function putWorkspaceSession(session: WorkspaceSession): Promise<WorkspaceSession> {
  const response = await putJson<WorkspaceSessionRead>(`${SERVER_BASE_URL}/domain/sessions/${encodeURIComponent(session.sessionId)}`, {
    session_id: session.sessionId,
    tab_id: session.tabId,
    window_id: session.windowId,
    page_url: session.pageUrl,
    page_title: session.pageTitle,
    selected_text: session.latestContext.selectedText,
    source_domain: session.latestContext.sourceDomain,
    status: session.status,
    active_thread_id: session.activeThreadId,
    active_turn_id: session.activeTurnId,
    active_run_id: session.activeRunId,
    compose_target: mapComposeTargetWrite(session.insertionTarget ?? session.latestContext.composeTarget),
  });

  return mapWorkspaceSession(response, session.latestContext.activeView, session.latestContext.tone, session.insertionTargetStatus);
}

export async function getWorkspaceSessionSnapshot(sessionId: string, signal?: AbortSignal): Promise<WorkspaceSessionSnapshot | null> {
  try {
    const response = await getJson<WorkspaceSessionSnapshotRead>(`${SERVER_BASE_URL}/domain/sessions/${encodeURIComponent(sessionId)}`, signal);
    return mapWorkspaceSessionSnapshot(response);
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      return null;
    }

    throw error;
  }
}

export async function getDomainHistory(limit = 20, signal?: AbortSignal): Promise<DomainHistoryItem[]> {
  const query = `?limit=${encodeURIComponent(String(limit))}`;
  const response = await getJson<DomainHistoryItemRead[]>(`${SERVER_BASE_URL}/domain/history${query}`, signal);
  return response.map(mapDomainHistoryItem);
}
