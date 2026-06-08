import type { ConnectionStatus, InsertionResult, PanelView, StreamedReply, Tone } from './types';

export const LAUNCH_SIDE_PANEL = 'draftlet:launch-side-panel';
export const GET_SIDE_PANEL_CONTEXT = 'draftlet:get-side-panel-context';
export const SIDE_PANEL_CONTEXT_UPDATED = 'draftlet:side-panel-context-updated';
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
  tabId?: number;
  windowId?: number;
}

export interface DraftletError {
  code: string;
  message: string;
  retryable: boolean;
  correlationId?: string;
}

export type DraftletMessage =
  | { type: typeof LAUNCH_SIDE_PANEL; context: DraftletSidePanelContext }
  | { type: typeof GET_SIDE_PANEL_CONTEXT }
  | { type: typeof SIDE_PANEL_CONTEXT_UPDATED; context: DraftletSidePanelContext }
  | { type: typeof GET_RUNTIME_STATUS }
  | { type: typeof START_DRAFT_GENERATION; context: DraftletSidePanelContext }
  | { type: typeof CANCEL_DRAFT_GENERATION; generationId?: string }
  | { type: typeof DRAFT_GENERATION_STARTED; generationId: string }
  | { type: typeof DRAFT_REPLY_RECEIVED; generationId: string; reply: StreamedReply }
  | { type: typeof DRAFT_GENERATION_COMPLETED; generationId: string; replyCount: number }
  | { type: typeof DRAFT_GENERATION_FAILED; generationId: string; error: DraftletError }
  | { type: typeof INSERT_REPLY; replyText: string };

export interface LaunchSidePanelResult {
  opened: boolean;
  message?: string;
}

export interface SidePanelContextResult {
  context: DraftletSidePanelContext | null;
}

export interface RuntimeStatusResult {
  status: ConnectionStatus;
}

export interface StartDraftGenerationResult {
  started: boolean;
  generationId?: string;
  error?: DraftletError;
}

export interface CancelDraftGenerationResult {
  canceled: boolean;
}

export interface InsertReplyResult {
  result: InsertionResult;
}
