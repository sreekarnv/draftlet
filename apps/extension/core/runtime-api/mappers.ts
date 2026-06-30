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
  RecoverableRunProjection,
  SourceSnapshot,
  Turn,
  WorkspaceSession,
  WorkspaceSessionSnapshot,
  ComposeTargetRef,
} from '@draftlet/shared/contracts';
import {
  isGenerationRunLiveFeedAttachmentMode,
  isGenerationRunStatus,
  isTone,
  isTurnStatus,
} from './types';

export function toSourcePayload(source: SourceSnapshot) {
  return {
    selected_text: source.selectedText,
    source_url: source.sourceUrl,
    source_domain: source.sourceDomain,
    page_title: source.pageTitle,
  };
}

export function mapDomainHistoryItem(item: DomainHistoryItemRead): DomainHistoryItem {
  return {
    session: mapWorkspaceSession(item.session),
    thread: mapConversationThreadSnapshot(item.thread),
  };
}

export function mapWorkspaceSessionSnapshot(snapshot: WorkspaceSessionSnapshotRead): WorkspaceSessionSnapshot {
  return {
    session: mapWorkspaceSession(snapshot.session),
    thread: snapshot.thread ? mapConversationThreadSnapshot(snapshot.thread) : null,
  };
}

export function mapConversationThreadSnapshot(snapshot: ConversationThreadSnapshotRead): ConversationThreadSnapshot {
  return {
    thread: mapConversationThread(snapshot.thread),
    turns: snapshot.turns.map(mapTurn),
    variants: snapshot.variants.map(mapDraftVariant),
    latestRecoverableRun: snapshot.latest_recoverable_run ? mapRecoverableRunProjection(snapshot.latest_recoverable_run) : undefined,
  };
}

export function mapGenerationRunProgressSnapshot(snapshot: GenerationRunProgressSnapshotRead): GenerationRunProgressSnapshot {
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

export function mapGenerationRunLiveFeedAttachment(
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

export function mapGenerationRunRestoreCandidate(candidate: GenerationRunRestoreCandidateRead): GenerationRunRestoreCandidate {
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

export function mapWorkspaceSession(
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

export function mapComposeTarget(target?: ComposeTargetRead | null): ComposeTargetRef | undefined {
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

export function mapComposeTargetWrite(target?: ComposeTargetRef): ComposeTargetWrite | undefined {
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

export function mapConversationThread(thread: ConversationThreadRead): ConversationThread {
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

export function mapTurn(turn: TurnRead): Turn {
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

export function mapDraftVariant(variant: DraftVariantRead): DraftVariant {
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

export function mapGenerationRun(run: GenerationRunRead): GenerationRun {
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

export function mapRecoverableRunProjection(run: RecoverableRunProjectionRead): RecoverableRunProjection {
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

export interface WorkspaceSessionRead {
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

export interface ComposeTargetRead {
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

export interface ComposeTargetWrite {
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

export interface ConversationThreadRead {
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

export interface TurnRead {
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

export interface DraftVariantRead {
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

export interface GenerationRunRead {
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

export interface RecoverableRunProjectionRead {
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

export interface GenerationRunExecutionStateRead {
  checked_at: string;
  stale_after_seconds: number;
  restore_candidates?: GenerationRunRestoreCandidateRead[] | null;
}

export interface GenerationRunProgressEventRead {
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

export interface GenerationRunLiveFeedAttachmentRead {
  mode: string;
  live_attached: boolean;
  replay_available: boolean;
  subscriber_count: number;
  reason: string | null;
}

export interface GenerationRunRestoreCandidateRead {
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

export interface GenerationRunProgressSnapshotRead {
  checked_at: string;
  run: GenerationRunRead;
  thread: ConversationThreadSnapshotRead | null;
  events: GenerationRunProgressEventRead[];
  replay_cursor: number;
  live_feed_attachment?: GenerationRunLiveFeedAttachmentRead | null;
}

export interface ConversationThreadSnapshotRead {
  thread: ConversationThreadRead;
  turns: TurnRead[];
  variants: DraftVariantRead[];
  latest_recoverable_run?: RecoverableRunProjectionRead | null;
}

export interface DomainHistoryItemRead {
  session: WorkspaceSessionRead;
  thread: ConversationThreadSnapshotRead;
}

export interface WorkspaceSessionSnapshotRead {
  session: WorkspaceSessionRead;
  thread: ConversationThreadSnapshotRead | null;
}
