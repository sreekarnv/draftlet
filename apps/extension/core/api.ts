import { SERVER_BASE_URL } from './constants';
import { streamSse, type SseMessage } from './sse-client';
import type { RecaptureDiagnosticsReport } from '../../../shared/recapture-diagnostics-contract';
import type {
  ConversationThread,
  ConversationThreadSnapshot,
  DomainHistoryItem,
  DraftVariant,
  GenerationRun,
  GenerationRunExecutionState,
  GenerationRunLiveFeedAttachment,
  GenerationRunProgressSnapshot,
  GenerationRunRestoreCandidate,
  GenerationRunStatus,
  SourceSnapshot,
  Turn,
  WorkspaceSession,
  WorkspaceSessionSnapshot,
} from './messages';
import type {
  ComposeTargetRef,
  PreferenceItem,
  PreferenceUpsert,
  ReplyRequestPayload,
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

interface StreamReplyGenerationRunEventsOptions {
  signal?: AbortSignal;
  onReply: (variant: StreamedDraftVariant) => void;
  onControl?: (event: StreamedGenerationControlEvent) => void;
}

interface StreamedDraftVariant {
  text: string;
  variantId?: string;
  sequence?: number;
}

interface StreamedGenerationControlEvent {
  status: 'run_started' | 'run_completed' | 'run_cancelled' | 'run_failed';
  message?: string;
  sequence?: number;
}

interface ReplyGenerationRunExecutionStartRead {
  run_id: string;
  started: boolean;
  live: boolean;
}

export interface ReplyGenerationRunExecutionStart {
  runId: string;
  started: boolean;
  live: boolean;
}

export async function startReplyGenerationRunExecution(
  runId: string,
  payload: ReplyRequestPayload,
): Promise<ReplyGenerationRunExecutionStart> {
  const response = await postJson<ReplyGenerationRunExecutionStartRead>(
    `${SERVER_BASE_URL}/replies/${encodeURIComponent(runId)}/start`,
    {
      ...payload,
      run_id: runId,
    },
  );

  return {
    runId: response.run_id,
    started: response.started,
    live: response.live,
  };
}

export async function streamReplyGenerationRunEvents(
  runId: string,
  {
    signal,
    afterSequence = 0,
    onReply,
    onControl,
  }: StreamReplyGenerationRunEventsOptions & { afterSequence?: number },
): Promise<void> {
  const query = afterSequence > 0 ? `?after=${encodeURIComponent(String(afterSequence))}` : '';
  await streamSse({
    url: `${SERVER_BASE_URL}/replies/${encodeURIComponent(runId)}/events${query}`,
    signal,
    onMessage(message) {
      const variant = parseStreamedDraftVariant(message);

      if (variant?.text) {
        onReply(variant);
        return;
      }

      const control = parseStreamedGenerationControlEvent(message);

      if (control) {
        onControl?.(control);
      }
    },
  });
}

export async function cancelReplyGenerationRunExecution(runId: string): Promise<{ cancelled: boolean }> {
  const response = await postJson<{ cancelled: boolean }>(`${SERVER_BASE_URL}/replies/${encodeURIComponent(runId)}/cancel`, {});
  return response;
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

export async function publishBrowserRecaptureDiagnosticsReport(report: RecaptureDiagnosticsReport): Promise<RecaptureDiagnosticsReport> {
  return putJson<RecaptureDiagnosticsReport>(`${SERVER_BASE_URL}/diagnostics/browser-recapture`, report);
}

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

export async function claimGenerationRun(run: {
  runId: string;
  sessionId: string;
  threadId: string;
  turnId: string;
  leaseOwner: string;
  staleAfterSeconds?: number;
}): Promise<GenerationRun> {
  const response = await putJson<GenerationRunRead>(`${SERVER_BASE_URL}/domain/generation-runs/${encodeURIComponent(run.runId)}`, {
    run_id: run.runId,
    session_id: run.sessionId,
    thread_id: run.threadId,
    turn_id: run.turnId,
    lease_owner: run.leaseOwner,
    status: 'active',
    stale_after_seconds: run.staleAfterSeconds,
  });

  return mapGenerationRun(response);
}

export async function heartbeatGenerationRun(
  runId: string,
  leaseOwner?: string,
): Promise<GenerationRun> {
  const response = await patchJson<GenerationRunRead>(`${SERVER_BASE_URL}/domain/generation-runs/${encodeURIComponent(runId)}/heartbeat`, {
    lease_owner: leaseOwner,
  });

  return mapGenerationRun(response);
}

export async function getActiveGenerationRuns(filters: {
  sessionId?: string;
  threadId?: string;
  turnId?: string;
} = {}): Promise<GenerationRun[]> {
  const params = new URLSearchParams();

  if (filters.sessionId) {
    params.set('session_id', filters.sessionId);
  }

  if (filters.threadId) {
    params.set('thread_id', filters.threadId);
  }

  if (filters.turnId) {
    params.set('turn_id', filters.turnId);
  }

  const query = params.size > 0 ? `?${params.toString()}` : '';
  const response = await getJson<GenerationRunRead[]>(`${SERVER_BASE_URL}/domain/generation-runs/active${query}`);
  return response.map(mapGenerationRun);
}

export async function getGenerationRunExecutionState(filters: {
  sessionId?: string;
  threadId?: string;
  turnId?: string;
  staleAfterSeconds?: number;
} = {}): Promise<GenerationRunExecutionState> {
  const params = new URLSearchParams();

  if (filters.sessionId) {
    params.set('session_id', filters.sessionId);
  }

  if (filters.threadId) {
    params.set('thread_id', filters.threadId);
  }

  if (filters.turnId) {
    params.set('turn_id', filters.turnId);
  }

  if (filters.staleAfterSeconds !== undefined) {
    params.set('stale_after_seconds', String(filters.staleAfterSeconds));
  }

  const query = params.size > 0 ? `?${params.toString()}` : '';
  const response = await getJson<GenerationRunExecutionStateRead>(`${SERVER_BASE_URL}/domain/generation-runs/execution-state${query}`);

  return {
    checkedAt: response.checked_at,
    staleAfterSeconds: response.stale_after_seconds,
    active: response.active.map(mapGenerationRun),
    live: response.live.map(mapGenerationRun),
    stale: response.stale.map(mapGenerationRun),
    feedAttachments: mapGenerationRunFeedAttachments(response.feed_attachments),
    restoreCandidates: (response.restore_candidates ?? []).map(mapGenerationRunRestoreCandidate),
  };
}

export async function getGenerationRunProgress(
  runId: string,
  options: { afterSequence?: number; limit?: number } = {},
): Promise<GenerationRunProgressSnapshot | null> {
  const params = new URLSearchParams();

  if (options.afterSequence !== undefined) {
    params.set('after_sequence', String(options.afterSequence));
  }

  if (options.limit !== undefined) {
    params.set('limit', String(options.limit));
  }

  const query = params.size > 0 ? `?${params.toString()}` : '';

  try {
    const response = await getJson<GenerationRunProgressSnapshotRead>(
      `${SERVER_BASE_URL}/domain/generation-runs/${encodeURIComponent(runId)}/progress${query}`,
    );
    return mapGenerationRunProgressSnapshot(response);
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      return null;
    }

    throw error;
  }
}

export async function patchGenerationRunStatus(
  runId: string,
  status: GenerationRunStatus,
  error?: { code?: string; message?: string },
): Promise<GenerationRun> {
  const response = await patchJson<GenerationRunRead>(`${SERVER_BASE_URL}/domain/generation-runs/${encodeURIComponent(runId)}/status`, {
    status,
    error_code: error?.code,
    error_message: error?.message,
  });

  return mapGenerationRun(response);
}

export async function reconcileGenerationRuns(filters: {
  sessionId?: string;
  threadId?: string;
  turnId?: string;
  staleAfterSeconds?: number;
  error?: { code?: string; message?: string };
} = {}): Promise<GenerationRun[]> {
  const response = await postJson<GenerationRunRead[]>(`${SERVER_BASE_URL}/domain/generation-runs/reconcile`, {
    session_id: filters.sessionId,
    thread_id: filters.threadId,
    turn_id: filters.turnId,
    stale_after_seconds: filters.staleAfterSeconds ?? 0,
    error_code: filters.error?.code,
    error_message: filters.error?.message,
  });

  return response.map(mapGenerationRun);
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

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
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

function parseStreamedDraftVariant(message: SseMessage): StreamedDraftVariant | null {
  if (message.eventType === 'variant_persisted') {
    try {
      const payload = JSON.parse(message.data) as DraftVariantStreamPayload;
      return {
        text: payload.reply,
        variantId: payload.variant_id,
        sequence: parseSseSequence(message.id),
      };
    } catch {
      return null;
    }
  }

  return null;
}

function parseStreamedGenerationControlEvent(message: SseMessage): StreamedGenerationControlEvent | null {
  if (
    message.eventType !== 'run_started'
    && message.eventType !== 'run_completed'
    && message.eventType !== 'run_cancelled'
    && message.eventType !== 'run_failed'
  ) {
    return null;
  }

  return {
    status: message.eventType,
    message: message.data || undefined,
    sequence: parseSseSequence(message.id),
  };
}

function parseSseSequence(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}


function toSourcePayload(source: SourceSnapshot) {
  return {
    selected_text: source.selectedText,
    source_url: source.sourceUrl,
    source_domain: source.sourceDomain,
    page_title: source.pageTitle,
  };
}


function mapDomainHistoryItem(item: DomainHistoryItemRead): DomainHistoryItem {
  return {
    session: mapWorkspaceSession(item.session),
    thread: mapConversationThreadSnapshot(item.thread),
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
    latestRecoverableRun: snapshot.latest_recoverable_run ? mapRecoverableRunProjection(snapshot.latest_recoverable_run) : undefined,
  };
}

function mapGenerationRunProgressSnapshot(snapshot: GenerationRunProgressSnapshotRead): GenerationRunProgressSnapshot {
  return {
    checkedAt: snapshot.checked_at,
    run: mapGenerationRun(snapshot.run),
    thread: snapshot.thread ? mapConversationThreadSnapshot(snapshot.thread) : null,
    events: snapshot.events.map((event) => ({
      sequence: event.sequence,
      eventType: event.event_type,
      runId: event.run_id,
      sessionId: event.session_id,
      threadId: event.thread_id,
      turnId: event.turn_id,
      status: event.status ?? undefined,
      variantId: event.variant_id ?? undefined,
      at: event.at ?? undefined,
    })),
    replayCursor: snapshot.replay_cursor,
    liveFeedAttachment: snapshot.live_feed_attachment
      ? mapGenerationRunLiveFeedAttachment(snapshot.live_feed_attachment)
      : undefined,
  };
}

function mapGenerationRunLiveFeedAttachment(
  attachment: GenerationRunLiveFeedAttachmentRead,
): GenerationRunLiveFeedAttachment {
  return {
    mode: isGenerationRunLiveFeedAttachmentMode(attachment.mode) ? attachment.mode : 'replay_only',
    liveAttached: attachment.live_attached,
    replayAvailable: attachment.replay_available,
    subscriberCount: attachment.subscriber_count,
    reason: attachment.reason ?? undefined,
  };
}

function mapGenerationRunFeedAttachments(
  attachments?: Record<string, GenerationRunLiveFeedAttachmentRead> | null,
): Record<string, GenerationRunLiveFeedAttachment> {
  if (!attachments) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(attachments).map(([runId, attachment]) => [
      runId,
      mapGenerationRunLiveFeedAttachment(attachment),
    ]),
  );
}

function mapGenerationRunRestoreCandidate(candidate: GenerationRunRestoreCandidateRead): GenerationRunRestoreCandidate {
  return {
    runId: candidate.run_id,
    sessionId: candidate.session_id,
    threadId: candidate.thread_id,
    turnId: candidate.turn_id,
    status: isGenerationRunStatus(candidate.status) ? candidate.status : 'active',
    leaseOwner: candidate.lease_owner,
    restoreMode: isGenerationRunLiveFeedAttachmentMode(candidate.restore_mode) ? candidate.restore_mode : 'stale',
    liveAttached: candidate.live_attached,
    replayAvailable: candidate.replay_available,
    subscriberCount: candidate.subscriber_count,
    recoverable: candidate.recoverable,
    stale: candidate.stale,
    interrupted: candidate.interrupted,
    reason: candidate.reason ?? undefined,
    claimedAt: candidate.claimed_at,
    heartbeatAt: candidate.heartbeat_at ?? undefined,
    interruptedAt: candidate.interrupted_at ?? undefined,
    lastActivityAt: candidate.last_activity_at ?? undefined,
    updatedAt: candidate.updated_at,
  };
}

function mapWorkspaceSession(
  session: WorkspaceSessionRead,
  activeView?: WorkspaceSession['latestContext']['activeView'],
  tone?: WorkspaceSession['latestContext']['tone'],
  insertionTargetStatus?: WorkspaceSession['insertionTargetStatus'],
): WorkspaceSession {
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
      composeTarget: mapComposeTarget(session.compose_target),
    },
    status: session.status === 'stale' ? 'stale' : 'active',
    activeThreadId: session.active_thread_id ?? undefined,
    activeTurnId: session.active_turn_id ?? undefined,
    activeRunId: session.active_run_id ?? undefined,
    insertionTarget: mapComposeTarget(session.compose_target),
    insertionTargetStatus: insertionTargetStatus ?? (session.compose_target ? 'stale' : 'needs_recapture'),
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };
}

function mapComposeTarget(target?: ComposeTargetRead | null): ComposeTargetRef | undefined {
  if (!target) {
    return undefined;
  }

  return {
    targetId: target.target_id,
    kind: target.kind === 'textarea' || target.kind === 'contenteditable' ? target.kind : 'input',
    pageUrl: target.page_url,
    origin: target.origin ?? undefined,
    pageTitle: target.page_title ?? undefined,
    selector: target.selector ?? undefined,
    fingerprint: target.fingerprint,
    label: target.label ?? undefined,
    lastSeenAt: target.last_seen_at,
  };
}

function mapComposeTargetWrite(target?: ComposeTargetRef): ComposeTargetWrite | undefined {
  if (!target) {
    return undefined;
  }

  return {
    target_id: target.targetId,
    kind: target.kind,
    page_url: target.pageUrl,
    origin: target.origin,
    page_title: target.pageTitle,
    selector: target.selector,
    fingerprint: target.fingerprint,
    label: target.label,
    last_seen_at: target.lastSeenAt,
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
    generationStartedAt: turn.generation_started_at ?? undefined,
    generationCompletedAt: turn.generation_completed_at ?? undefined,
    generationFailedAt: turn.generation_failed_at ?? undefined,
    generationCancelledAt: turn.generation_cancelled_at ?? undefined,
    generationErrorCode: turn.generation_error_code ?? undefined,
    generationErrorMessage: turn.generation_error_message ?? undefined,
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
    createdAt: variant.created_at,
    updatedAt: variant.updated_at,
  };
}

function mapGenerationRun(run: GenerationRunRead): GenerationRun {
  return {
    runId: run.run_id,
    sessionId: run.session_id,
    threadId: run.thread_id,
    turnId: run.turn_id,
    status: isGenerationRunStatus(run.status) ? run.status : 'active',
    leaseOwner: run.lease_owner,
    claimedAt: run.claimed_at,
    heartbeatAt: run.heartbeat_at ?? undefined,
    releasedAt: run.released_at ?? undefined,
    completedAt: run.completed_at ?? undefined,
    cancelledAt: run.cancelled_at ?? undefined,
    interruptedAt: run.interrupted_at ?? undefined,
    failedAt: run.failed_at ?? undefined,
    errorCode: run.error_code ?? undefined,
    errorMessage: run.error_message ?? undefined,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  };
}

function mapRecoverableRunProjection(run: RecoverableRunProjectionRead) {
  return {
    runId: run.run_id,
    turnId: run.turn_id,
    status: isGenerationRunStatus(run.status) ? run.status : 'interrupted',
    recoverable: run.recoverable,
    reason: run.reason ?? undefined,
    interruptedAt: run.interrupted_at ?? undefined,
    lastEventAt: run.last_event_at ?? undefined,
    errorCode: run.error_code ?? undefined,
    errorMessage: run.error_message ?? undefined,
  };
}

function isTone(value: string): value is DraftVariant['tone'] {
  return value === 'professional' || value === 'friendly' || value === 'concise';
}

function isTurnStatus(value: string): value is Turn['generationStatus'] {
  return value === 'queued' || value === 'started' || value === 'streaming' || value === 'completed' || value === 'failed' || value === 'cancelled';
}

function isGenerationRunStatus(value: string): value is GenerationRunStatus {
  return value === 'active' || value === 'streaming' || value === 'completed' || value === 'failed' || value === 'cancelled' || value === 'interrupted';
}

function isGenerationRunLiveFeedAttachmentMode(value: string | undefined): value is GenerationRunLiveFeedAttachment['mode'] {
  return value === 'live_attached' || value === 'replay_only' || value === 'stale';
}

interface DraftVariantStreamPayload {
  reply: string;
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
  active_turn_id: string | null;
  active_run_id: string | null;
  compose_target?: ComposeTargetRead | null;
  created_at: string;
  updated_at: string;
}

interface ComposeTargetRead {
  target_id: string;
  kind: string;
  page_url: string;
  origin: string | null;
  page_title: string | null;
  selector: string | null;
  fingerprint: string;
  label: string | null;
  last_seen_at: string;
}

interface ComposeTargetWrite {
  target_id: string;
  kind: string;
  page_url: string;
  origin?: string;
  page_title?: string;
  selector?: string;
  fingerprint: string;
  label?: string;
  last_seen_at: string;
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
  generation_started_at: string | null;
  generation_completed_at: string | null;
  generation_failed_at: string | null;
  generation_cancelled_at: string | null;
  generation_error_code: string | null;
  generation_error_message: string | null;
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
  created_at: string;
  updated_at: string;
}

interface GenerationRunRead {
  run_id: string;
  session_id: string;
  thread_id: string;
  turn_id: string;
  status: string;
  lease_owner: string;
  claimed_at: string;
  heartbeat_at: string | null;
  released_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  interrupted_at: string | null;
  failed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface RecoverableRunProjectionRead {
  run_id: string;
  turn_id: string;
  status: string;
  recoverable: boolean;
  reason: string | null;
  interrupted_at: string | null;
  last_event_at: string | null;
  error_code: string | null;
  error_message: string | null;
}

interface GenerationRunExecutionStateRead {
  checked_at: string;
  stale_after_seconds: number;
  active: GenerationRunRead[];
  live: GenerationRunRead[];
  stale: GenerationRunRead[];
  feed_attachments?: Record<string, GenerationRunLiveFeedAttachmentRead> | null;
  restore_candidates?: GenerationRunRestoreCandidateRead[] | null;
}

interface GenerationRunProgressEventRead {
  sequence: number;
  event_type: string;
  run_id: string;
  session_id: string;
  thread_id: string;
  turn_id: string;
  status: string | null;
  variant_id: string | null;
  at: string | null;
}

interface GenerationRunLiveFeedAttachmentRead {
  mode: string;
  live_attached: boolean;
  replay_available: boolean;
  subscriber_count: number;
  reason: string | null;
}

interface GenerationRunRestoreCandidateRead {
  run_id: string;
  session_id: string;
  thread_id: string;
  turn_id: string;
  status: string;
  lease_owner: string;
  restore_mode: string;
  live_attached: boolean;
  replay_available: boolean;
  subscriber_count: number;
  recoverable: boolean;
  stale: boolean;
  interrupted: boolean;
  reason: string | null;
  claimed_at: string;
  heartbeat_at: string | null;
  interrupted_at: string | null;
  last_activity_at: string | null;
  updated_at: string;
}

interface GenerationRunProgressSnapshotRead {
  checked_at: string;
  run: GenerationRunRead;
  thread: ConversationThreadSnapshotRead | null;
  events: GenerationRunProgressEventRead[];
  replay_cursor: number;
  live_feed_attachment?: GenerationRunLiveFeedAttachmentRead | null;
}

interface ConversationThreadSnapshotRead {
  thread: ConversationThreadRead;
  turns: TurnRead[];
  variants: DraftVariantRead[];
  latest_recoverable_run?: RecoverableRunProjectionRead | null;
}


interface DomainHistoryItemRead {
  session: WorkspaceSessionRead;
  thread: ConversationThreadSnapshotRead;
}

interface WorkspaceSessionSnapshotRead {
  session: WorkspaceSessionRead;
  thread: ConversationThreadSnapshotRead | null;
}
