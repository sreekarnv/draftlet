import type { WorkspaceRestoreState } from '../../../core/messages';
import { buildWorkspaceRestoreState } from '../../../core/restore-conflict';
import type { SidePanelState } from '../state';

export function buildCurrentRestoreState(state: SidePanelState): WorkspaceRestoreState | null {
  if (!state.currentSession) {
    return null;
  }

  return buildWorkspaceRestoreState({
    session: state.currentSession,
    thread: state.currentThreadSnapshot,
    source: state.currentSession.restoreState?.source ?? 'session_update',
  });
}
