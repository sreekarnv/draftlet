import type { DomainHistoryItem, WorkspaceRestoreState } from '../../core/messages';
import type { PanelState } from '../../core/types';
import type { InsertionTargetViewState } from '../../ui/mount-panel';
import type { PanelViewState } from './panel-types';

export function getStateText(view: PanelViewState) {
  if (view.state === 'loading') {
    return 'Requesting replies...';
  }

  if (view.state === 'streaming') {
    return 'Streaming';
  }

  if (view.state === 'success') {
    return draftCount(view) > 0 ? 'Ready' : 'No replies returned.';
  }

  if (view.state === 'error') {
    return view.errorMessage || 'Could not generate replies.';
  }

  return draftCount(view) > 0 ? 'Ready' : 'Choose tone';
}

export function stateToneClass(state: PanelState) {
  if (state === 'error') {
    return 'text-rose-600';
  }

  if (state === 'success') {
    return 'text-emerald-700';
  }

  if (state === 'loading' || state === 'streaming') {
    return 'text-slate-700';
  }

  return '';
}

export function targetStatusLabel(target: InsertionTargetViewState) {
  if (target.status === 'live') {
    return 'Ready to insert';
  }

  if (target.status === 'stale') {
    return 'Target stale';
  }

  if (target.status === 'unavailable') {
    return 'Target unavailable';
  }

  if (target.status === 'needs_focus') {
    return 'Click the compose field';
  }

  if (target.status === 'tab_disambiguation_required') {
    return 'Original page not found';
  }

  return 'Needs a compose field';
}

export function targetToneClass(status: InsertionTargetViewState['status']) {
  if (status === 'live') {
    return 'text-emerald-700';
  }

  if (status === 'stale' || status === 'tab_disambiguation_required' || status === 'needs_focus') {
    return 'text-amber-700';
  }

  return 'text-slate-500';
}

export function restoreGuidanceToneClass(status: WorkspaceRestoreState['status']) {
  if (status === 'conflict') {
    return 'bg-rose-50 text-rose-950 ring-rose-200';
  }

  if (status === 'needs_action') {
    return 'bg-amber-50 text-amber-950 ring-amber-200';
  }

  return 'bg-slate-50 text-slate-700 ring-slate-200';
}

export function insertionTrailToneClass(level: NonNullable<InsertionTargetViewState['trail']>[number]['level']) {
  if (level === 'success') {
    return 'bg-emerald-500';
  }

  if (level === 'warning') {
    return 'bg-amber-500';
  }

  if (level === 'failed') {
    return 'bg-rose-500';
  }

  return 'bg-slate-400';
}

export function tabCandidateLabel(candidate: NonNullable<InsertionTargetViewState['candidates']>[number]) {
  const title = candidate.title || candidate.origin || candidate.url || `Tab ${candidate.tabId}`;
  const hint = candidate.active ? 'active' : candidate.currentWindow ? 'current window' : candidate.matchReason.replace('_', ' ');
  return `${title} · ${hint}`;
}

export function draftCount(view: PanelViewState) {
  return view.threadSnapshot?.variants.length ?? 0;
}

export function summarizeHistoryItem(item: DomainHistoryItem) {
  const latestTurn = [...item.thread.turns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).at(0);
  const preferredVariant = item.thread.variants.find((variant) => variant.status === 'accepted')
    ?? item.thread.variants.find((variant) => variant.isCurrent)
    ?? [...item.thread.variants].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).at(0);
  const title = item.thread.thread.source.pageTitle || item.session.pageTitle || item.thread.thread.source.sourceDomain || 'Saved thread';
  const turnCount = item.thread.turns.length;
  const variantCount = item.thread.variants.length;

  return {
    title,
    counts: `${turnCount} ${turnCount === 1 ? 'turn' : 'turns'} · ${variantCount} ${variantCount === 1 ? 'variant' : 'variants'}`,
    latestInstruction: latestTurn ? turnInstructionLabel(latestTurn.instruction, 0) : '',
    latestDraft: preferredVariant?.content ?? '',
    updatedAt: latestHistoryActivity(item),
  };
}

export function turnInstructionLabel(instruction: string, index: number) {
  if (index === 0 && instruction === 'Generate reply drafts') {
    return 'Initial draft generation';
  }

  return instruction;
}

export function formatSource(domain: string | null, url: string | null): { domain: string; path: string; title: string } | null {
  if (url) {
    try {
      const parsed = new URL(url);
      const sourceDomain = domain || parsed.hostname;
      const path = parsed.pathname && parsed.pathname !== '/' ? truncate(parsed.pathname, 36) : '';

      return {
        domain: sourceDomain || 'local page',
        path,
        title: url,
      };
    } catch {
      return {
        domain: domain || 'source',
        path: truncate(url, 44),
        title: url,
      };
    }
  }

  if (domain) {
    return { domain, path: '', title: domain };
  }

  return null;
}

export function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function latestHistoryActivity(item: DomainHistoryItem) {
  const timestamps = [
    item.session.updatedAt,
    item.thread.thread.updatedAt,
    ...item.thread.turns.map((turn) => turn.updatedAt),
    ...item.thread.variants.map((variant) => variant.updatedAt),
  ].filter(Boolean);

  return timestamps.sort((a, b) => b.localeCompare(a))[0] ?? item.thread.thread.updatedAt;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}
