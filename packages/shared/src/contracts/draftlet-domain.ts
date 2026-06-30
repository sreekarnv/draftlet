export type Tone = 'professional' | 'friendly' | 'concise';

export type PanelView = 'replies' | 'history';

export type ConnectionStatus = 'connected' | 'disconnected';

export interface RuntimeStatus {
  status: ConnectionStatus;
  checkedAt?: string;
  service?: string;
  version?: string;
}

export type GenerationMode = 'initial' | 'refinement';

export interface ReplyRequestPayload {
  selected_text: string;
  tone: Tone;
  model?: string;
  source_url?: string;
  source_domain?: string;
  page_title?: string;
  session_id?: string;
  thread_id?: string;
  turn_id?: string;
  run_id?: string;
  instruction?: string;
  generation_mode?: GenerationMode;
}

export type ComposeTargetKind = 'input' | 'textarea' | 'contenteditable';

export type InsertionTargetStatus =
  | 'live'
  | 'stale'
  | 'unavailable'
  | 'needs_recapture'
  | 'needs_focus'
  | 'tab_disambiguation_required';

export interface ComposeTargetRef {
  targetId: string;
  kind: ComposeTargetKind;
  pageUrl: string;
  origin?: string;
  pageTitle?: string;
  selector?: string;
  fingerprint: string;
  label?: string;
  lastSeenAt: string;
}

export type InsertionStatus = 'inserted' | 'copied' | 'failed';

export interface InsertionRequest {
  sessionId?: string;
  replyText: string;
  variantId?: string;
  target?: ComposeTargetRef;
}

export interface InsertionResult {
  status: InsertionStatus;
  message: string;
  targetStatus?: InsertionTargetStatus;
  errorCode?: string;
}

export interface DraftletSidePanelContext {
  selectedText: string;
  tone?: Tone;
  activeView?: PanelView;
  sourceUrl: string;
  sourceDomain?: string;
  pageTitle?: string;
  tabId?: number;
  windowId?: number;
  composeTarget?: ComposeTargetRef;
}

export type WorkspaceSessionStatus = 'active' | 'stale';

export type WorkspaceRestoreSource = 'current_tab' | 'history' | 'session_update';
export type WorkspaceRestoreStatus = 'ready' | 'restored' | 'needs_action' | 'conflict';
export type WorkspaceRestoreIssueSeverity = 'info' | 'warning' | 'error';
export type WorkspaceRecoveryActionKind =
  | 'choose_tab'
  | 'recapture_target'
  | 'retry_interrupted_run'
  | 'wait_for_active_run'
  | 'copy_fallback';

export type WorkspaceRestoreIssueCode =
  | 'restored_session'
  | 'restored_thread'
  | 'active_run_restored'
  | 'active_run_replay_only'
  | 'active_run_reconciled'
  | 'active_run_recovery_failed'
  | 'active_context_mismatch'
  | 'tab_choice_required'
  | 'target_stale'
  | 'target_unavailable'
  | 'target_needs_focus'
  | 'target_needs_recapture'
  | 'interrupted_run_retryable';

export interface WorkspaceRecoveryAction {
  kind: WorkspaceRecoveryActionKind;
  label: string;
  message: string;
  turnId?: string;
}

export interface WorkspaceRestoreIssue {
  code: WorkspaceRestoreIssueCode;
  severity: WorkspaceRestoreIssueSeverity;
  message: string;
  action?: WorkspaceRecoveryAction;
  candidateCount?: number;
  runId?: string;
  threadId?: string;
  turnId?: string;
}

export interface WorkspaceRestoreState {
  source: WorkspaceRestoreSource;
  status: WorkspaceRestoreStatus;
  summary: string;
  primaryAction?: WorkspaceRecoveryAction;
  issues: WorkspaceRestoreIssue[];
  restoredSession: boolean;
  restoredThread: boolean;
  activeThreadId?: string;
  activeTurnId?: string;
  activeRunId?: string;
}

export type PlausibleTabMatchReason = 'target_url' | 'target_origin' | 'session_url';

export interface PlausibleTabCandidate {
  tabId: number;
  windowId?: number;
  title?: string;
  url?: string;
  origin?: string;
  active?: boolean;
  currentWindow?: boolean;
  matchReason: PlausibleTabMatchReason;
}

export interface WorkspaceSession {
  sessionId: string;
  tabId: number;
  windowId?: number;
  pageUrl: string;
  pageTitle?: string;
  latestContext: DraftletSidePanelContext;
  status: WorkspaceSessionStatus;
  createdAt: string;
  updatedAt: string;
  activeThreadId?: string;
  activeTurnId?: string;
  activeRunId?: string;
  insertionTarget?: ComposeTargetRef;
  insertionTargetStatus?: InsertionTargetStatus;
  plausibleTabs?: PlausibleTabCandidate[];
  restoreState?: WorkspaceRestoreState;
}

export interface SourceSnapshot {
  selectedText: string;
  sourceUrl: string;
  sourceDomain?: string;
  pageTitle?: string;
}

export type ConversationThreadStatus = 'active' | 'archived';
export type TurnGenerationStatus = 'queued' | 'started' | 'streaming' | 'completed' | 'failed' | 'cancelled';
export type DraftVariantStatus = 'generated' | 'accepted' | 'rejected';
export type GenerationRunStatus = 'active' | 'streaming' | 'completed' | 'failed' | 'cancelled' | 'interrupted';

export interface ConversationThread {
  threadId: string;
  sessionId: string;
  source: SourceSnapshot;
  status: ConversationThreadStatus;
  createdAt: string;
  updatedAt: string;
  latestTurnId?: string;
}

export interface Turn {
  turnId: string;
  threadId: string;
  instruction: string;
  source: SourceSnapshot;
  tone: Tone;
  generationStatus: TurnGenerationStatus;
  generationStartedAt?: string;
  generationCompletedAt?: string;
  generationFailedAt?: string;
  generationCancelledAt?: string;
  generationErrorCode?: string;
  generationErrorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DraftVariant {
  variantId: string;
  turnId: string;
  tone: Tone;
  length?: string;
  content: string;
  rank: number;
  status: DraftVariantStatus;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationRun {
  runId: string;
  sessionId: string;
  threadId: string;
  turnId: string;
  status: GenerationRunStatus;
  leaseOwner: string;
  claimedAt: string;
  heartbeatAt?: string;
  releasedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  interruptedAt?: string;
  failedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecoverableRunProjection {
  runId: string;
  turnId: string;
  status: GenerationRunStatus;
  recoverable: boolean;
  reason?: string;
  interruptedAt?: string;
  lastEventAt?: string;
  errorCode?: string;
  errorMessage?: string;
}

export type GenerationRunProgressEventType =
  | 'run_started'
  | 'variant_persisted'
  | 'run_completed'
  | 'run_cancelled'
  | 'run_failed'
  | 'generation_run_status'
  | 'draft_variant_generated'
  | string;

export interface GenerationRunProgressEvent {
  sequence: number;
  eventType: GenerationRunProgressEventType;
  runId: string;
  sessionId: string;
  threadId: string;
  turnId: string;
  status?: string;
  variantId?: string;
  at?: string;
}

export type GenerationRunLiveFeedAttachmentMode = 'live_attached' | 'replay_only' | 'stale';

export interface GenerationRunLiveFeedAttachment {
  mode: GenerationRunLiveFeedAttachmentMode;
  liveAttached: boolean;
  replayAvailable: boolean;
  subscriberCount: number;
  reason?: string;
}

export interface GenerationRunRestoreCandidate {
  runId: string;
  sessionId: string;
  threadId: string;
  turnId: string;
  status: GenerationRunStatus;
  leaseOwner: string;
  restoreMode: GenerationRunLiveFeedAttachmentMode;
  liveAttached: boolean;
  replayAvailable: boolean;
  subscriberCount: number;
  recoverable: boolean;
  stale: boolean;
  interrupted: boolean;
  reason?: string;
  claimedAt: string;
  heartbeatAt?: string;
  interruptedAt?: string;
  lastActivityAt?: string;
  updatedAt: string;
}

export interface ConversationThreadSnapshot {
  thread: ConversationThread;
  turns: Turn[];
  variants: DraftVariant[];
  latestRecoverableRun?: RecoverableRunProjection;
}

export interface GenerationRunProgressSnapshot {
  checkedAt: string;
  run: GenerationRun;
  thread: ConversationThreadSnapshot | null;
  events: GenerationRunProgressEvent[];
  replayCursor: number;
  liveFeedAttachment?: GenerationRunLiveFeedAttachment;
}

export interface GenerationRunExecutionState {
  checkedAt: string;
  staleAfterSeconds: number;
  restoreCandidates: GenerationRunRestoreCandidate[];
}

export interface WorkspaceSessionSnapshot {
  session: WorkspaceSession;
  thread: ConversationThreadSnapshot | null;
}

export interface DomainHistoryItem {
  session: WorkspaceSession;
  thread: ConversationThreadSnapshot;
}

export interface DraftletError {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
  correlationId?: string;
}

export interface DraftVariantStreamPayload {
  reply: string;
  variant_id: string;
  turn_id?: string | null;
  thread_id?: string | null;
}

export interface StreamedDraftVariant {
  text: string;
  variantId?: string;
  turnId?: string;
  threadId?: string;
  sequence?: number;
}

export type StreamedGenerationControlStatus = 'run_started' | 'run_completed' | 'run_cancelled' | 'run_failed';

export interface StreamedGenerationControlEvent {
  status: StreamedGenerationControlStatus;
  message?: string;
  sequence?: number;
}

export type GenerationStreamEvent = StreamedDraftVariant | StreamedGenerationControlEvent;

export interface ReplyGenerationRunExecutionStart {
  runId: string;
  started: boolean;
  live: boolean;
}
