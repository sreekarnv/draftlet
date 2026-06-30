import type { WorkspaceRestoreState } from '../../../core/messages';
import { buildWorkspaceRestoreState } from '../../../core/restore-conflict';
import type { SidePanelState } from '../state';

export function buildCurrentRestoreState(state: SidePanelState): WorkspaceRestoreState | null {
  if (!state.runtime.currentSession) {
    return null;
  }

  return buildWorkspaceRestoreState({
    session: state.runtime.currentSession,
    thread: state.runtime.currentThreadSnapshot,
    source: state.runtime.currentSession.restoreState?.source ?? 'session_update',
  });
}
