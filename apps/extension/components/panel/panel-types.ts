import type {
  ConversationThreadSnapshot,
  DomainHistoryItem,
  WorkspaceRestoreState,
} from '../../core/messages';
import type { ConnectionStatus, PanelState, PanelView, Tone } from '../../core/types';
import type { InsertionTargetViewState } from '../../ui/mount-panel';

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
}
