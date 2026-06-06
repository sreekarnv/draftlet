import type { InsertionResult, PanelView, Tone } from './types';

export const LAUNCH_SIDE_PANEL = 'draftlet:launch-side-panel';
export const GET_SIDE_PANEL_CONTEXT = 'draftlet:get-side-panel-context';
export const SIDE_PANEL_CONTEXT_UPDATED = 'draftlet:side-panel-context-updated';
export const INSERT_REPLY = 'draftlet:insert-reply';

export interface DraftletSidePanelContext {
  selectedText: string;
  tone: Tone;
  activeView: PanelView;
  sourceUrl: string;
  sourceDomain?: string;
  tabId?: number;
  windowId?: number;
}

export type DraftletMessage =
  | { type: typeof LAUNCH_SIDE_PANEL; context: DraftletSidePanelContext }
  | { type: typeof GET_SIDE_PANEL_CONTEXT }
  | { type: typeof SIDE_PANEL_CONTEXT_UPDATED; context: DraftletSidePanelContext }
  | { type: typeof INSERT_REPLY; replyText: string };

export interface LaunchSidePanelResult {
  opened: boolean;
  message?: string;
}

export interface SidePanelContextResult {
  context: DraftletSidePanelContext | null;
}

export interface InsertReplyResult {
  result: InsertionResult;
}
