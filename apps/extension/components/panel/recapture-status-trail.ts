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
  if (isSameTrailingItem(trail[trail.length - 1], event, message, tabId)) {
    return trail;
  }

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

export function replaceLastTrail(
  trail: RecaptureStatusTrailItem[],
  event: RecaptureStatusTrailEvent,
  level: RecaptureStatusTrailLevel,
  message: string,
  tabId?: number,
): RecaptureStatusTrailItem[] {
  if (trail.length === 0) {
    return appendTrail(trail, event, level, message, tabId);
  }

  const next = trail.slice(0, -1);
  next.push({
    event,
    level,
    message,
    tabId,
    at: new Date().toISOString(),
  });
  return next.slice(-MAX_RECAPTURE_TRAIL_ITEMS);
}

function isSameTrailingItem(
  last: RecaptureStatusTrailItem | undefined,
  event: RecaptureStatusTrailEvent,
  message: string,
  tabId: number | undefined,
): boolean {
  if (!last) {
    return false;
  }

  return last.event === event
    && last.message === message
    && last.tabId === tabId;
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
    return 'Ready to insert into the saved compose field.';
  }

  if (status === 'stale') {
    return 'Target stale; Draftlet will recheck before inserting.';
  }

  if (status === 'unavailable') {
    return 'Original page is not available. Use Copy for this reply.';
  }

  if (status === 'needs_focus') {
    return 'Click the compose field on the original page to insert.';
  }

  if (status === 'tab_disambiguation_required') {
    return 'Original page is not available. Use Copy for this reply.';
  }

  return 'Click the compose field on the original page to insert.';
}
