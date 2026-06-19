import type {
  InsertionStatusTrailEvent,
  InsertionStatusTrailItem,
  InsertionStatusTrailLevel,
  RecaptureInsertionTargetResult,
  WorkspaceSession,
} from '../../core/messages';
import type { InsertionTargetStatus } from '../../core/types';
import { MAX_INSERTION_TRAIL_ITEMS } from '../../ui/sidepanel/state';

export function appendTrail(
  trail: InsertionStatusTrailItem[],
  event: InsertionStatusTrailEvent,
  level: InsertionStatusTrailLevel,
  message: string,
  tabId?: number,
): InsertionStatusTrailItem[] {
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
  ].slice(-MAX_INSERTION_TRAIL_ITEMS);
}

export function replaceLastTrail(
  trail: InsertionStatusTrailItem[],
  event: InsertionStatusTrailEvent,
  level: InsertionStatusTrailLevel,
  message: string,
  tabId?: number,
): InsertionStatusTrailItem[] {
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
  return next.slice(-MAX_INSERTION_TRAIL_ITEMS);
}

function isSameTrailingItem(
  last: InsertionStatusTrailItem | undefined,
  event: InsertionStatusTrailEvent,
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

export function trailEventForInsertion(response: RecaptureInsertionTargetResult): InsertionStatusTrailEvent {
  if (response.outcome === 'recapture_succeeded') {
    return 'recapture_succeeded';
  }

  if (response.outcome === 'needs_focused_compose_target' || response.outcome === 'tab_choice_acknowledged') {
    return 'focus_required';
  }

  return 'recapture_failed';
}

export function trailLevelForInsertion(response: RecaptureInsertionTargetResult): InsertionStatusTrailLevel {
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
    return 'Draftlet will recheck the compose field before inserting.';
  }

  if (status === 'unavailable') {
    return 'Draftlet cannot reach the original compose field. Use Copy and paste manually.';
  }

  if (status === 'needs_focus') {
    return 'Click the compose field on the original page, then try inserting again.';
  }

  if (status === 'tab_disambiguation_required') {
    return 'Draftlet cannot reach the original compose field. Use Copy and paste manually.';
  }

  return 'Click the compose field on the original page, then try inserting again.';
}
