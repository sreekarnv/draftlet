export type Tone = 'professional' | 'friendly' | 'concise';
export type ConnectionStatus = 'connected' | 'disconnected';
export type PanelState = 'empty' | 'loading' | 'streaming' | 'success' | 'error';
export type PanelView = 'replies' | 'history';

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
  instruction?: string;
}

export interface StreamedReply {
  text: string;
  replyId?: number;
  variantId?: string;
  threadId?: string;
  turnId?: string;
}

export interface ReplyItem {
  id: string;
  text: string;
  persistedId?: number;
}

export interface HistoryReply {
  id: number;
  reply_index: number;
  text: string;
  created_at: string;
}

export interface HistoryGeneration {
  id: number;
  selected_text: string;
  tone: string;
  model: string;
  source_url: string | null;
  source_domain: string | null;
  status: string;
  created_at: string;
  replies: HistoryReply[];
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
}
