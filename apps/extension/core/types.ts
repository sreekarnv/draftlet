export type Tone = 'professional' | 'friendly' | 'concise';
export type ConnectionStatus = 'connected' | 'disconnected';
export type PanelState = 'empty' | 'loading' | 'streaming' | 'success' | 'error';
export type PanelView = 'replies' | 'history';

export type GenerationMode = 'initial' | 'refinement';
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

export interface PreferenceItem {
  id: number;
  scope: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface PreferenceUpsert {
  scope: string;
  key: string;
  value: string;
}

export type InsertionStatus = 'inserted' | 'copied' | 'failed';

export interface InsertionResult {
  status: InsertionStatus;
  message: string;
  targetStatus?: InsertionTargetStatus;
  errorCode?: string;
}
