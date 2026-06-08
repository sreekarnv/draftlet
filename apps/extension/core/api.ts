import { SERVER_BASE_URL } from './constants';
import { streamSse, type SseMessage } from './sse-client';
import type {
  ConversationThread,
  ConversationThreadSnapshot,
  DraftVariant,
  SourceSnapshot,
  Turn,
  WorkspaceSession,
  WorkspaceSessionSnapshot,
} from './messages';
import type {
  HistoryGeneration,
  PreferenceItem,
  PreferenceUpsert,
  ReplyRequestPayload,
  StreamedReply,
} from './types';

export async function checkServerHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(`${SERVER_BASE_URL}/health`, {
      headers: { Accept: 'application/json' },
      signal,
    });

    return response.ok;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    return false;
  }
}

interface StreamRepliesOptions {
  signal?: AbortSignal;
  onReply: (reply: StreamedReply) => void;
}

export async function streamReplies(
  payload: ReplyRequestPayload,
  { signal, onReply }: StreamRepliesOptions,
): Promise<void> {
  await streamSse({
    url: `${SERVER_BASE_URL}/replies`,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    signal,
    onMessage(message) {
      const reply = parseStreamedReply(message);

      if (reply?.text) {
        onReply(reply);
      }
    },
  });
}

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
  });

  return mapWorkspaceSession(response, session.latestContext.activeView, session.latestContext.tone);
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

export async function patchTurnStatus(turnId: string, status: Turn['generationStatus']): Promise<Turn> {
  const query = `?status=${encodeURIComponent(status)}`;
  const response = await fetch(`${SERVER_BASE_URL}/domain/turns/${encodeURIComponent(turnId)}/status${query}`, {
    method: 'PATCH',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Turn status request failed with ${response.status}`);
  }

  return mapTurn(await response.json() as TurnRead);
}

export async function putDraftVariant(variant: DraftVariant): Promise<DraftVariant> {
  const response = await putJson<DraftVariantRead>(`${SERVER_BASE_URL}/domain/variants/${encodeURIComponent(variant.variantId)}`, {
    variant_id: variant.variantId,
    turn_id: variant.turnId,
    tone: variant.tone,
    length: variant.length,
    content: variant.content,
    rank: variant.rank,
    status: variant.status,
    is_current: variant.isCurrent,
    legacy_reply_id: variant.persistedReplyId,
  });

  return mapDraftVariant(response);
}

export async function patchDraftVariantState(
  variantId: string,
  state: { isCurrent?: boolean; status?: DraftVariant['status'] },
): Promise<ConversationThreadSnapshot> {
  const response = await patchJson<ConversationThreadSnapshotRead>(`${SERVER_BASE_URL}/domain/variants/${encodeURIComponent(variantId)}/state`, {
    is_current: state.isCurrent,
    status: state.status,
  });

  return mapConversationThreadSnapshot(response);
}

export async function getHistory(signal?: AbortSignal): Promise<HistoryGeneration[]> {
  return getJson<HistoryGeneration[]>(`${SERVER_BASE_URL}/history`, signal);
}

export async function getPreferences(scope?: string, signal?: AbortSignal): Promise<PreferenceItem[]> {
  const query = scope ? `?scope=${encodeURIComponent(scope)}` : '';
  return getJson<PreferenceItem[]>(`${SERVER_BASE_URL}/preferences${query}`, signal);
}

export async function putPreference(preference: PreferenceUpsert): Promise<PreferenceItem> {
  const response = await fetch(`${SERVER_BASE_URL}/preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(preference),
  });

  if (!response.ok) {
    throw new Error(`Preference request failed with ${response.status}`);
  }

  return response.json() as Promise<PreferenceItem>;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function patchJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function putJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function parseStreamedReply(message: SseMessage): StreamedReply | null {
  if (message.eventType === 'draft_variant') {
    try {
      const payload = JSON.parse(message.data) as DraftVariantStreamPayload;
      return {
        text: payload.reply,
        replyId: payload.reply_id ?? undefined,
        variantId: payload.variant_id,
        threadId: payload.thread_id ?? undefined,
        turnId: payload.turn_id ?? undefined,
      };
    } catch {
      return null;
    }
  }

  const reply = message.data.trim();

  if (!reply) {
    return null;
  }

  return { text: reply, replyId: parseSseId(message.id) };
}

function parseSseId(id: string | undefined): number | undefined {
  if (!id) {
    return undefined;
  }

  const value = Number.parseInt(id, 10);
  return Number.isFinite(value) ? value : undefined;
}

function toSourcePayload(source: SourceSnapshot) {
  return {
    selected_text: source.selectedText,
    source_url: source.sourceUrl,
    source_domain: source.sourceDomain,
    page_title: source.pageTitle,
  };
}

function mapWorkspaceSessionSnapshot(snapshot: WorkspaceSessionSnapshotRead): WorkspaceSessionSnapshot {
  return {
    session: mapWorkspaceSession(snapshot.session),
    thread: snapshot.thread ? mapConversationThreadSnapshot(snapshot.thread) : null,
  };
}

function mapConversationThreadSnapshot(snapshot: ConversationThreadSnapshotRead): ConversationThreadSnapshot {
  return {
    thread: mapConversationThread(snapshot.thread),
    turns: snapshot.turns.map(mapTurn),
    variants: snapshot.variants.map(mapDraftVariant),
  };
}

function mapWorkspaceSession(session: WorkspaceSessionRead, activeView?: WorkspaceSession['latestContext']['activeView'], tone?: WorkspaceSession['latestContext']['tone']): WorkspaceSession {
  return {
    sessionId: session.session_id,
    tabId: session.tab_id ?? -1,
    windowId: session.window_id ?? undefined,
    pageUrl: session.page_url,
    pageTitle: session.page_title ?? undefined,
    latestContext: {
      selectedText: session.selected_text,
      sourceUrl: session.page_url,
      sourceDomain: session.source_domain ?? undefined,
      pageTitle: session.page_title ?? undefined,
      tabId: session.tab_id ?? undefined,
      windowId: session.window_id ?? undefined,
      activeView,
      tone,
    },
    status: session.status === 'stale' ? 'stale' : 'active',
    activeThreadId: session.active_thread_id ?? undefined,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };
}

function mapConversationThread(thread: ConversationThreadRead): ConversationThread {
  return {
    threadId: thread.thread_id,
    sessionId: thread.session_id,
    source: {
      selectedText: thread.selected_text,
      sourceUrl: thread.source_url,
      sourceDomain: thread.source_domain ?? undefined,
      pageTitle: thread.page_title ?? undefined,
    },
    status: thread.status === 'archived' ? 'archived' : 'active',
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
    latestTurnId: undefined,
  };
}

function mapTurn(turn: TurnRead): Turn {
  return {
    turnId: turn.turn_id,
    threadId: turn.thread_id,
    instruction: turn.instruction,
    source: {
      selectedText: turn.selected_text,
      sourceUrl: turn.source_url,
      sourceDomain: turn.source_domain ?? undefined,
      pageTitle: turn.page_title ?? undefined,
    },
    tone: isTone(turn.tone) ? turn.tone : 'professional',
    generationStatus: isTurnStatus(turn.generation_status) ? turn.generation_status : 'queued',
    createdAt: turn.created_at,
    updatedAt: turn.updated_at,
  };
}

function mapDraftVariant(variant: DraftVariantRead): DraftVariant {
  return {
    variantId: variant.variant_id,
    turnId: variant.turn_id,
    tone: isTone(variant.tone) ? variant.tone : 'professional',
    length: variant.length ?? undefined,
    content: variant.content,
    rank: variant.rank,
    status: variant.status === 'accepted' || variant.status === 'rejected' ? variant.status : 'generated',
    isCurrent: variant.is_current,
    persistedReplyId: variant.legacy_reply_id ?? undefined,
    createdAt: variant.created_at,
    updatedAt: variant.updated_at,
  };
}

function isTone(value: string): value is DraftVariant['tone'] {
  return value === 'professional' || value === 'friendly' || value === 'concise';
}

function isTurnStatus(value: string): value is Turn['generationStatus'] {
  return value === 'queued' || value === 'streaming' || value === 'completed' || value === 'failed' || value === 'cancelled';
}

interface DraftVariantStreamPayload {
  reply: string;
  reply_id?: number | null;
  variant_id: string;
  turn_id?: string | null;
  thread_id?: string | null;
}

interface WorkspaceSessionRead {
  session_id: string;
  tab_id: number | null;
  window_id: number | null;
  page_url: string;
  page_title: string | null;
  selected_text: string;
  source_domain: string | null;
  status: string;
  active_thread_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ConversationThreadRead {
  thread_id: string;
  session_id: string;
  selected_text: string;
  source_url: string;
  source_domain: string | null;
  page_title: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TurnRead {
  turn_id: string;
  thread_id: string;
  instruction: string;
  selected_text: string;
  source_url: string;
  source_domain: string | null;
  page_title: string | null;
  tone: string;
  generation_status: string;
  created_at: string;
  updated_at: string;
}

interface DraftVariantRead {
  variant_id: string;
  turn_id: string;
  tone: string;
  length: string | null;
  content: string;
  rank: number;
  status: string;
  is_current: boolean;
  legacy_reply_id: number | null;
  created_at: string;
  updated_at: string;
}

interface ConversationThreadSnapshotRead {
  thread: ConversationThreadRead;
  turns: TurnRead[];
  variants: DraftVariantRead[];
}

interface WorkspaceSessionSnapshotRead {
  session: WorkspaceSessionRead;
  thread: ConversationThreadSnapshotRead | null;
}
