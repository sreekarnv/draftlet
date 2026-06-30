import { SERVER_BASE_URL } from '../constants';
import type {
  ConversationThread,
  ConversationThreadSnapshot,
  Turn,
} from '@draftlet/shared/contracts';
import { getJson, putJson } from './transport';
import {
  mapConversationThread,
  mapConversationThreadSnapshot,
  mapTurn,
  toSourcePayload,
  type ConversationThreadRead,
  type ConversationThreadSnapshotRead,
  type TurnRead,
} from './mappers';

export async function getConversationThreadSnapshot(threadId: string, signal?: AbortSignal): Promise<ConversationThreadSnapshot | null> {
  try {
    const response = await getJson<ConversationThreadSnapshotRead>(`${SERVER_BASE_URL}/domain/threads/${encodeURIComponent(threadId)}`, signal);
    return mapConversationThreadSnapshot(response);
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      return null;
    }

    throw error;
  }
}

export async function putConversationThread(thread: ConversationThread): Promise<ConversationThread> {
  const response = await putJson<ConversationThreadRead>(`${SERVER_BASE_URL}/domain/threads/${encodeURIComponent(thread.threadId)}`, {
    thread_id: thread.threadId,
    session_id: thread.sessionId,
    source: toSourcePayload(thread.source),
    status: thread.status,
  });

  return mapConversationThread(response);
}

export async function putTurn(turn: Turn): Promise<Turn> {
  const response = await putJson<TurnRead>(`${SERVER_BASE_URL}/domain/turns/${encodeURIComponent(turn.turnId)}`, {
    turn_id: turn.turnId,
    thread_id: turn.threadId,
    instruction: turn.instruction,
    source: toSourcePayload(turn.source),
    tone: turn.tone,
    generation_status: turn.generationStatus,
  });

  return mapTurn(response);
}

export async function patchTurnStatus(
  turnId: string,
  status: Turn['generationStatus'],
  error?: { code?: string; message?: string },
): Promise<Turn> {
  const response = await fetch(`${SERVER_BASE_URL}/domain/turns/${encodeURIComponent(turnId)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      status,
      error_code: error?.code,
      error_message: error?.message,
    }),
  });

  if (!response.ok) {
    throw new Error(`Turn status request failed with ${response.status}`);
  }

  return mapTurn(await response.json() as TurnRead);
}
