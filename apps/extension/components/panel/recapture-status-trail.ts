import type {
  RecaptureInsertionTargetResult,
  RecaptureStatusTrailEvent,
  RecaptureStatusTrailItem,
  RecaptureStatusTrailLevel,
  WorkspaceSession,
} from '../../core/messages';
import type { InsertionTargetStatus } from '../../core/types';
import { MAX_RECAPTURE_TRAIL_ITEMS } from '../../ui/sidepanel/state';

export function appendTrail(
  trail: RecaptureStatusTrailItem[],
  event: RecaptureStatusTrailEvent,
  level: RecaptureStatusTrailLevel,
  message: string,
  tabId?: number,
): RecaptureStatusTrailItem[] {
  return [
    ...trail,
    {
      event,
      level,
      message,
      tabId,
      at: new Date().toISOString(),
    },
  ].slice(-MAX_RECAPTURE_TRAIL_ITEMS);
}

export function trailEventForRecapture(response: RecaptureInsertionTargetResult): RecaptureStatusTrailEvent {
  if (response.outcome === 'recapture_succeeded') {
    return 'recapture_succeeded';
  }

  if (response.outcome === 'needs_focused_compose_target' || response.outcome === 'tab_choice_acknowledged') {
    return 'focus_required';
  }

  return 'recapture_failed';
}

export function trailLevelForRecapture(response: RecaptureInsertionTargetResult): RecaptureStatusTrailLevel {
  if (response.outcome === 'recapture_succeeded') {
    return 'success';
  }

  if (response.outcome === 'needs_focused_compose_target' || response.outcome === 'tab_choice_acknowledged') {
    return 'warning';
  }

  return 'failed';
}

export function insertionTargetMessage(session: WorkspaceSession): string {
  const status: InsertionTargetStatus = session.insertionTargetStatus ?? (session.insertionTarget ? 'stale' : 'needs_recapture');

  if (status === 'live') {
    return 'Target available';
  }

  if (status === 'stale') {
    return 'Target stale; Draftlet will recheck before inserting.';
  }

  if (status === 'unavailable') {
    return 'Target unavailable; Copy still works.';
  }

  if (status === 'needs_focus') {
    return 'Focus a compose field in the selected tab, then retry recapture.';
  }

  if (status === 'tab_disambiguation_required') {
    return 'Choose the tab with the compose field, then recapture.';
  }

  return 'Focus a compose field and recapture to enable insertion.';
}
