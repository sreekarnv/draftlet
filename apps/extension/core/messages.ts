import type { ComposeTargetRef, ConnectionStatus, InsertionResult, InsertionTargetStatus, PanelView, Tone } from './types';
import type { PlausibleTabCandidate } from './tab-disambiguation';
import type { DesktopExtensionDiagnosticsBridgeResult } from '../../../shared/recapture-diagnostics-contract';

export const LAUNCH_SIDE_PANEL = 'draftlet:launch-side-panel';
export const GET_CURRENT_WORKSPACE_SESSION = 'draftlet:get-current-workspace-session';
export const GET_DOMAIN_HISTORY = 'draftlet:get-domain-history';
export const GET_RECAPTURE_DIAGNOSTICS = 'draftlet:get-recapture-diagnostics';
export const PUBLISH_RECAPTURE_DIAGNOSTICS_REPORT = 'draftlet:publish-recapture-diagnostics-report';
export const RESTORE_DOMAIN_THREAD = 'draftlet:restore-domain-thread';
export const WORKSPACE_SESSION_UPDATED = 'draftlet:workspace-session-updated';
export const CONVERSATION_THREAD_UPDATED = 'draftlet:conversation-thread-updated';
export const GET_RUNTIME_STATUS = 'draftlet:get-runtime-status';
export const START_DRAFT_GENERATION = 'draftlet:start-draft-generation';
export const START_DRAFT_REFINEMENT = 'draftlet:start-draft-refinement';
export const CANCEL_DRAFT_GENERATION = 'draftlet:cancel-draft-generation';
export const DRAFT_GENERATION_STARTED = 'draftlet:draft-generation-started';
export const DRAFT_GENERATION_COMPLETED = 'draftlet:draft-generation-completed';
export const DRAFT_GENERATION_FAILED = 'draftlet:draft-generation-failed';
export const INSERT_REPLY = 'draftlet:insert-reply';
export const GET_INSERTION_TARGET_STATUS = 'draftlet:get-insertion-target-status';
export const REVALIDATE_INSERTION_TARGET = 'draftlet:revalidate-insertion-target';
export const RECAPTURE_INSERTION_TARGET = 'draftlet:recapture-insertion-target';
export const ACTIVATE_RECAPTURE_TAB = 'draftlet:activate-recapture-tab';
export const SET_CURRENT_DRAFT_VARIANT = 'draftlet:set-current-draft-variant';
export const ACCEPT_DRAFT_VARIANT = 'draftlet:accept-draft-variant';

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
export type WorkspaceGenerationStatus = 'starting' | 'streaming';
export type GenerationRunStatus = 'active' | 'streaming' | 'completed' | 'failed' | 'cancelled' | 'interrupted';

export interface WorkspaceSessionGeneration {
  generationId: string;
  threadId?: string;
  turnId?: string;
  status: WorkspaceGenerationStatus;
  startedAt: string;
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
  activeGeneration?: WorkspaceSessionGeneration;
  insertionTarget?: ComposeTargetRef;
  insertionTargetStatus?: InsertionTargetStatus;
  plausibleTabs?: PlausibleTabCandidate[];
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

export interface ConversationThreadSnapshot {
  thread: ConversationThread;
  turns: Turn[];
  variants: DraftVariant[];
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
  correlationId?: string;
}

export type RecaptureInsertionTargetFailureReason =
  | 'session_not_found'
  | 'tab_disambiguation_required'
  | 'tab_unavailable'
  | 'content_script_unavailable'
  | 'no_focused_compose_target'
  | 'target_stale'
  | 'target_metadata_missing';

export type RecaptureInsertionTargetOutcome =
  | 'tab_choice_acknowledged'
  | 'needs_focused_compose_target'
  | 'chosen_tab_unavailable'
  | 'recapture_succeeded'
  | 'recapture_failed';

export type RecaptureStatusTrailEvent =
  | 'tab_activation_requested'
  | 'tab_activated'
  | 'tab_activation_failed'
  | 'recapture_requested'
  | 'focus_required'
  | 'recapture_succeeded'
  | 'recapture_failed';

export type RecaptureStatusTrailLevel = 'pending' | 'success' | 'warning' | 'failed';

export interface RecaptureStatusTrailItem {
  event: RecaptureStatusTrailEvent;
  level: RecaptureStatusTrailLevel;
  message: string;
  tabId?: number;
  at: string;
}

export type RecaptureDiagnosticEvent =
  | 'recapture_requested'
  | 'tab_resolution_ambiguous'
  | 'tab_resolution_missing'
  | 'content_recapture_requested'
  | 'content_recapture_completed'
  | 'content_recapture_failed'
  | 'tab_activation_requested'
  | 'tab_activation_completed'
  | 'tab_activation_failed';

export type RecaptureDiagnosticLevel = 'debug' | 'info' | 'warning' | 'error';

export interface RecaptureDiagnosticEntry {
  id: number;
  event: RecaptureDiagnosticEvent;
  level: RecaptureDiagnosticLevel;
  sessionId: string;
  tabId?: number;
  status?: InsertionTargetStatus;
  outcome?: RecaptureInsertionTargetOutcome;
  reason?: RecaptureInsertionTargetFailureReason | string;
  message: string;
  at: string;
}

export type DraftletMessage =
  | { type: typeof LAUNCH_SIDE_PANEL; context: DraftletSidePanelContext }
  | { type: typeof GET_CURRENT_WORKSPACE_SESSION; tabId?: number }
  | { type: typeof GET_DOMAIN_HISTORY; limit?: number }
  | { type: typeof GET_RECAPTURE_DIAGNOSTICS; sessionId?: string; limit?: number }
  | { type: typeof PUBLISH_RECAPTURE_DIAGNOSTICS_REPORT; sessionId?: string; limit?: number }
  | { type: typeof RESTORE_DOMAIN_THREAD; sessionId: string; threadId: string }
  | { type: typeof WORKSPACE_SESSION_UPDATED; session: WorkspaceSession }
  | { type: typeof CONVERSATION_THREAD_UPDATED; sessionId: string; snapshot: ConversationThreadSnapshot }
  | { type: typeof GET_RUNTIME_STATUS }
  | { type: typeof START_DRAFT_GENERATION; sessionId: string; tone?: Tone; activeView?: PanelView }
  | { type: typeof START_DRAFT_REFINEMENT; sessionId: string; instruction: string; tone?: Tone; activeView?: PanelView }
  | { type: typeof CANCEL_DRAFT_GENERATION; sessionId?: string; generationId?: string }
  | {
      type: typeof DRAFT_GENERATION_STARTED;
      sessionId: string;
      generationId: string;
      thread: ConversationThread;
      turn: Turn;
    }
  | {
      type: typeof DRAFT_GENERATION_COMPLETED;
      sessionId: string;
      generationId: string;
      thread: ConversationThread;
      turn: Turn;
      variants: DraftVariant[];
    }
  | {
      type: typeof DRAFT_GENERATION_FAILED;
      sessionId: string;
      generationId: string;
      threadId?: string;
      turnId?: string;
      error: DraftletError;
    }
  | { type: typeof INSERT_REPLY; sessionId?: string; replyText: string; variantId?: string; target?: ComposeTargetRef }
  | { type: typeof GET_INSERTION_TARGET_STATUS; sessionId?: string }
  | { type: typeof REVALIDATE_INSERTION_TARGET; sessionId: string; target?: ComposeTargetRef }
  | { type: typeof RECAPTURE_INSERTION_TARGET; sessionId: string; tabId?: number; target?: ComposeTargetRef }
  | { type: typeof ACTIVATE_RECAPTURE_TAB; sessionId: string; tabId: number }
  | { type: typeof SET_CURRENT_DRAFT_VARIANT; sessionId: string; variantId: string }
  | { type: typeof ACCEPT_DRAFT_VARIANT; sessionId: string; variantId: string };

export interface LaunchSidePanelResult {
  opened: boolean;
  session?: WorkspaceSession;
  message?: string;
}

export interface WorkspaceSessionResult {
  session: WorkspaceSession | null;
  thread?: ConversationThreadSnapshot | null;
}

export interface RuntimeStatusResult {
  status: ConnectionStatus;
}

export interface DomainHistoryResult {
  items: DomainHistoryItem[];
  error?: DraftletError;
}

export interface RecaptureDiagnosticsResult {
  entries: RecaptureDiagnosticEntry[];
}

export type PublishRecaptureDiagnosticsReportResult = DesktopExtensionDiagnosticsBridgeResult;

export interface RestoreDomainThreadResult {
  restored: boolean;
  session?: WorkspaceSession;
  thread?: ConversationThreadSnapshot;
  error?: DraftletError;
}

export interface StartDraftGenerationResult {
  started: boolean;
  sessionId?: string;
  generationId?: string;
  threadId?: string;
  turnId?: string;
  error?: DraftletError;
}

export interface CancelDraftGenerationResult {
  canceled: boolean;
}

export interface InsertReplyResult {
  result: InsertionResult;
}

export interface InsertionTargetStatusResult {
  status: InsertionTargetStatus;
  target?: ComposeTargetRef;
  candidates?: PlausibleTabCandidate[];
  message?: string;
}

export interface RecaptureInsertionTargetResult {
  recaptured: boolean;
  status: InsertionTargetStatus;
  outcome: RecaptureInsertionTargetOutcome;
  target?: ComposeTargetRef;
  selectedTab?: PlausibleTabCandidate;
  candidates?: PlausibleTabCandidate[];
  reason?: RecaptureInsertionTargetFailureReason;
  message: string;
}

export interface ActivateRecaptureTabResult {
  activated: boolean;
  tab?: PlausibleTabCandidate;
  error?: DraftletError;
  message: string;
}

export interface DraftVariantStateResult {
  updated: boolean;
  snapshot?: ConversationThreadSnapshot;
  error?: DraftletError;
}
