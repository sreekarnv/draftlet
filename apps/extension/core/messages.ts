import type { ConnectionStatus, InsertionResult, PanelView, Tone } from './types';

export const LAUNCH_SIDE_PANEL = 'draftlet:launch-side-panel';
export const GET_CURRENT_WORKSPACE_SESSION = 'draftlet:get-current-workspace-session';
export const WORKSPACE_SESSION_UPDATED = 'draftlet:workspace-session-updated';
export const CONVERSATION_THREAD_UPDATED = 'draftlet:conversation-thread-updated';
export const GET_RUNTIME_STATUS = 'draftlet:get-runtime-status';
export const START_DRAFT_GENERATION = 'draftlet:start-draft-generation';
export const START_DRAFT_REFINEMENT = 'draftlet:start-draft-refinement';
export const CANCEL_DRAFT_GENERATION = 'draftlet:cancel-draft-generation';
export const DRAFT_GENERATION_STARTED = 'draftlet:draft-generation-started';
export const DRAFT_VARIANT_RECEIVED = 'draftlet:draft-variant-received';
export const DRAFT_GENERATION_COMPLETED = 'draftlet:draft-generation-completed';
export const DRAFT_GENERATION_FAILED = 'draftlet:draft-generation-failed';
export const INSERT_REPLY = 'draftlet:insert-reply';
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
}

export type WorkspaceSessionStatus = 'active' | 'stale';
export type WorkspaceGenerationStatus = 'starting' | 'streaming';

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
}

export interface SourceSnapshot {
  selectedText: string;
  sourceUrl: string;
  sourceDomain?: string;
  pageTitle?: string;
}

export type ConversationThreadStatus = 'active' | 'archived';
export type TurnGenerationStatus = 'queued' | 'streaming' | 'completed' | 'failed' | 'cancelled';
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
  persistedReplyId?: number;
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

export interface DraftletError {
  code: string;
  message: string;
  retryable: boolean;
  correlationId?: string;
}

export type DraftletMessage =
  | { type: typeof LAUNCH_SIDE_PANEL; context: DraftletSidePanelContext }
  | { type: typeof GET_CURRENT_WORKSPACE_SESSION; tabId?: number }
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
  | { type: typeof DRAFT_VARIANT_RECEIVED; sessionId: string; generationId: string; variant: DraftVariant }
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
  | { type: typeof INSERT_REPLY; sessionId?: string; replyText: string; variantId?: string }
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

export interface DraftVariantStateResult {
  updated: boolean;
  snapshot?: ConversationThreadSnapshot;
  error?: DraftletError;
}
