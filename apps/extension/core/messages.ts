import type { ConnectionStatus, InsertionResult, PanelView, StreamedReply, Tone } from './types';

export const LAUNCH_SIDE_PANEL = 'draftlet:launch-side-panel';
export const GET_CURRENT_WORKSPACE_SESSION = 'draftlet:get-current-workspace-session';
export const WORKSPACE_SESSION_UPDATED = 'draftlet:workspace-session-updated';
export const GET_RUNTIME_STATUS = 'draftlet:get-runtime-status';
export const START_DRAFT_GENERATION = 'draftlet:start-draft-generation';
export const CANCEL_DRAFT_GENERATION = 'draftlet:cancel-draft-generation';
export const DRAFT_GENERATION_STARTED = 'draftlet:draft-generation-started';
export const DRAFT_REPLY_RECEIVED = 'draftlet:draft-reply-received';
export const DRAFT_GENERATION_COMPLETED = 'draftlet:draft-generation-completed';
export const DRAFT_GENERATION_FAILED = 'draftlet:draft-generation-failed';
export const INSERT_REPLY = 'draftlet:insert-reply';

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
  activeGeneration?: WorkspaceSessionGeneration;
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
  | { type: typeof GET_RUNTIME_STATUS }
  | { type: typeof START_DRAFT_GENERATION; sessionId: string; tone?: Tone; activeView?: PanelView }
  | { type: typeof CANCEL_DRAFT_GENERATION; sessionId?: string; generationId?: string }
  | { type: typeof DRAFT_GENERATION_STARTED; sessionId: string; generationId: string }
  | { type: typeof DRAFT_REPLY_RECEIVED; sessionId: string; generationId: string; reply: StreamedReply }
  | { type: typeof DRAFT_GENERATION_COMPLETED; sessionId: string; generationId: string; replyCount: number }
  | { type: typeof DRAFT_GENERATION_FAILED; sessionId: string; generationId: string; error: DraftletError }
  | { type: typeof INSERT_REPLY; sessionId?: string; replyText: string };

export interface LaunchSidePanelResult {
  opened: boolean;
  session?: WorkspaceSession;
  message?: string;
}

export interface WorkspaceSessionResult {
  session: WorkspaceSession | null;
}

export interface RuntimeStatusResult {
  status: ConnectionStatus;
}

export interface StartDraftGenerationResult {
  started: boolean;
  sessionId?: string;
  generationId?: string;
  error?: DraftletError;
}

export interface CancelDraftGenerationResult {
  canceled: boolean;
}

export interface InsertReplyResult {
  result: InsertionResult;
}
