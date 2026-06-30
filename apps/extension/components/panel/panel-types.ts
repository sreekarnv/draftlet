import type {
  ConversationThreadSnapshot,
  DomainHistoryItem,
  WorkspaceRestoreState,
} from '../../core/messages';
import type { ConnectionStatus, PanelState, PanelView, Tone } from '../../core/types';
import type { InsertionTargetViewState } from '../../ui/mount-panel';
import type { SentenceBufferState } from './sentence-buffer';

export type LoadState = 'idle' | 'loading' | 'success' | 'error';

export interface PanelViewState {
  activeView: PanelView;
  selectedText: string;
  tone: Tone;
  state: PanelState;
  connectionStatus: ConnectionStatus;
  insertionTarget: InsertionTargetViewState;
  restoreState: WorkspaceRestoreState | null;
  threadSnapshot: ConversationThreadSnapshot | null;
  history: DomainHistoryItem[];
  historyState: LoadState;
  errorMessage: string;
  persistenceMessage: string;
  streamingDraft: StreamingDraftViewState | null;
}

export interface StreamingDraftViewState {
  sessionId: string;
  generationId: string;
  threadId: string;
  turnId: string;
  buffer: SentenceBufferState;
  isFinal: boolean;
  startedAt: number;
  updatedAt: number;
}
