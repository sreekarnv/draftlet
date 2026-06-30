export type {
  ComposeTargetKind,
  ComposeTargetRef,
  ConnectionStatus,
  GenerationMode,
  InsertionResult,
  InsertionStatus,
  InsertionTargetStatus,
  ReplyRequestPayload,
  Tone,
} from '@draftlet/shared/contracts';

export type PanelState = 'empty' | 'loading' | 'streaming' | 'success' | 'error';
export type { PanelView } from '@draftlet/shared/contracts';

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
