import type { BrowserDiagnosticsPublishReliabilityState } from './recapture-diagnostics-publish-retry';
import type {
  ComposeTargetRef,
  ConversationThreadSnapshot,
  DesktopExtensionDiagnosticsBridgeResult,
  DomainHistoryItem,
  DraftletError,
  DraftletSidePanelContext,
  InsertionRequest,
  InsertionResult,
  InsertionTargetStatus,
  PanelView,
  PlausibleTabCandidate,
  ReplyStyle,
  ReplySurface,
  RuntimeStatus,
  Tone,
  WorkspaceRestoreStatus,
  WorkspaceRestoreState,
  WorkspaceSession,
} from '@draftlet/shared/contracts';

export type {
  ComposeTargetKind,
  ComposeTargetRef,
  ConnectionStatus,
  ConversationThread,
  ConversationThreadSnapshot,
  ConversationThreadStatus,
  DomainHistoryItem,
  DraftletError,
  DraftletSidePanelContext,
  DraftVariant,
  DraftVariantStatus,
  GenerationRun,
  GenerationRunExecutionState,
  GenerationRunLiveFeedAttachment,
  GenerationRunLiveFeedAttachmentMode,
  GenerationRunProgressEvent,
  GenerationRunProgressSnapshot,
  GenerationRunRestoreCandidate,
  GenerationRunStatus,
  InsertionRequest,
  InsertionResult,
  InsertionStatus,
  InsertionTargetStatus,
  PlausibleTabCandidate,
  PlausibleTabMatchReason,
  ReplyStyle,
  ReplySurface,
  RecoverableRunProjection,
  RuntimeStatus,
  SourceSnapshot,
  Turn,
  TurnGenerationStatus,
  WorkspaceRecoveryAction,
  WorkspaceRecoveryActionKind,
  WorkspaceRestoreIssue,
  WorkspaceRestoreIssueCode,
  WorkspaceRestoreIssueSeverity,
  WorkspaceRestoreSource,
  WorkspaceRestoreState,
  WorkspaceRestoreStatus,
  WorkspaceSession,
  WorkspaceSessionSnapshot,
  WorkspaceSessionStatus,
} from '@draftlet/shared/contracts';

export type { BrowserDiagnosticsPublishReliabilityState } from './recapture-diagnostics-publish-retry';

export const LAUNCH_SIDE_PANEL = 'draftlet:launch-side-panel';
export const CREATE_COMMAND_SURFACE_SESSION = 'draftlet:create-command-surface-session';
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
export const DRAFT_TEXT_DELTA_RECEIVED = 'draftlet:draft-text-delta-received';
export const INSERT_REPLY = 'draftlet:insert-reply';
export const INSERTION_IN_PROGRESS = 'draftlet:insertion-in-progress';
export const GET_INSERTION_TARGET_STATUS = 'draftlet:get-insertion-target-status';
export const REVALIDATE_INSERTION_TARGET = 'draftlet:revalidate-insertion-target';
export const RECAPTURE_INSERTION_TARGET = 'draftlet:recapture-insertion-target';
export const ACTIVATE_RECAPTURE_TAB = 'draftlet:activate-recapture-tab';
export const ACTIVATE_INSERTION_TAB = 'draftlet:activate-insertion-tab';
export const SET_CURRENT_DRAFT_VARIANT = 'draftlet:set-current-draft-variant';
export const ACCEPT_DRAFT_VARIANT = 'draftlet:accept-draft-variant';

export type RecaptureInsertionTargetFailureReason =
  | 'session_not_found'
  | 'tab_disambiguation_required'
  | 'tab_unavailable'
  | 'content_script_unavailable'
  | 'no_focused_compose_target'
  | 'target_stale'
  | 'target_metadata_missing'
  | 'armed_capture_timeout';

export type RecaptureInsertionTargetOutcome =
  | 'tab_choice_acknowledged'
  | 'needs_focused_compose_target'
  | 'chosen_tab_unavailable'
  | 'recapture_succeeded'
  | 'recapture_failed';

export type InsertionStatusTrailEvent =
  | 'tab_activation_requested'
  | 'tab_activated'
  | 'tab_activation_failed'
  | 'recapture_requested'
  | 'focus_required'
  | 'recapture_succeeded'
  | 'recapture_failed';

export type InsertionStatusTrailLevel = 'pending' | 'success' | 'warning' | 'failed';

export interface InsertionStatusTrailItem {
  event: InsertionStatusTrailEvent;
  level: InsertionStatusTrailLevel;
  message: string;
  tabId?: number;
  at: string;
}

export type RecaptureDiagnosticEvent =
  | 'recapture_requested'
  | 'restore_state_projected'
  | 'target_revalidation_requested'
  | 'target_revalidation_completed'
  | 'target_revalidation_failed'
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
  status?: InsertionTargetStatus | WorkspaceRestoreStatus;
  outcome?: RecaptureInsertionTargetOutcome;
  reason?: RecaptureInsertionTargetFailureReason | string;
  message: string;
  at: string;
}

export type DraftletMessage =
  | { type: typeof LAUNCH_SIDE_PANEL; context: DraftletSidePanelContext }
  | { type: typeof CREATE_COMMAND_SURFACE_SESSION; context: DraftletSidePanelContext }
  | { type: typeof GET_CURRENT_WORKSPACE_SESSION; tabId?: number }
  | { type: typeof GET_DOMAIN_HISTORY; limit?: number }
  | { type: typeof GET_RECAPTURE_DIAGNOSTICS; sessionId?: string; limit?: number }
  | { type: typeof PUBLISH_RECAPTURE_DIAGNOSTICS_REPORT; sessionId?: string; limit?: number }
  | { type: typeof RESTORE_DOMAIN_THREAD; sessionId: string; threadId: string }
  | { type: typeof WORKSPACE_SESSION_UPDATED; session: WorkspaceSession }
  | { type: typeof CONVERSATION_THREAD_UPDATED; sessionId: string; snapshot: ConversationThreadSnapshot }
  | { type: typeof GET_RUNTIME_STATUS }
  | { type: typeof START_DRAFT_GENERATION; sessionId: string; tone?: Tone; replySurface?: ReplySurface; replyStyle?: ReplyStyle; activeView?: PanelView }
  | { type: typeof START_DRAFT_REFINEMENT; sessionId: string; instruction: string; tone?: Tone; replySurface?: ReplySurface; replyStyle?: ReplyStyle; activeView?: PanelView }
  | { type: typeof CANCEL_DRAFT_GENERATION; sessionId?: string; generationId?: string }
  | { type: typeof DRAFT_TEXT_DELTA_RECEIVED; sessionId: string; generationId: string; threadId: string; turnId: string; text: string; sequence?: number }
  | ({ type: typeof INSERT_REPLY } & InsertionRequest)
  | { type: typeof INSERTION_IN_PROGRESS; sessionId: string; message: string }
  | { type: typeof GET_INSERTION_TARGET_STATUS; sessionId?: string }
  | { type: typeof REVALIDATE_INSERTION_TARGET; sessionId: string; target?: ComposeTargetRef }
  | { type: typeof RECAPTURE_INSERTION_TARGET; sessionId: string; tabId?: number; target?: ComposeTargetRef }
  | { type: typeof ACTIVATE_RECAPTURE_TAB; sessionId: string; tabId: number }
  | { type: typeof ACTIVATE_INSERTION_TAB; sessionId: string }
  | { type: typeof SET_CURRENT_DRAFT_VARIANT; sessionId: string; variantId: string }
  | { type: typeof ACCEPT_DRAFT_VARIANT; sessionId: string; variantId: string };

export interface LaunchSidePanelResult {
  opened: boolean;
  session?: WorkspaceSession;
  message?: string;
}

export interface CreateCommandSurfaceSessionResult {
  created: boolean;
  session?: WorkspaceSession;
  error?: DraftletError;
}

export interface WorkspaceSessionResult {
  session: WorkspaceSession | null;
  thread?: ConversationThreadSnapshot | null;
  restoreState?: WorkspaceRestoreState;
}

export interface RuntimeStatusResult {
  status: RuntimeStatus['status'];
}

export interface DomainHistoryResult {
  items: DomainHistoryItem[];
  error?: DraftletError;
}

export interface RecaptureDiagnosticsResult {
  entries: RecaptureDiagnosticEntry[];
  publish: BrowserDiagnosticsPublishReliabilityState;
}

export type PublishRecaptureDiagnosticsReportResult = DesktopExtensionDiagnosticsBridgeResult;

export interface RestoreDomainThreadResult {
  restored: boolean;
  session?: WorkspaceSession;
  thread?: ConversationThreadSnapshot;
  restoreState?: WorkspaceRestoreState;
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
