import type { PlausibleTabCandidate, PlausibleTabMatchReason, WorkspaceSession } from './messages';

export type { PlausibleTabCandidate, PlausibleTabMatchReason } from './messages';

export interface CandidateTabInput {
  id?: number;
  windowId?: number;
  title?: string;
  url?: string;
  active?: boolean;
  currentWindow?: boolean;
}

export function findPlausibleTabCandidates(
  tabs: CandidateTabInput[],
  session: WorkspaceSession,
): PlausibleTabCandidate[] {
  const candidates = tabs
    .map((tab) => toCandidate(tab, session))
    .filter((candidate): candidate is PlausibleTabCandidate => candidate !== null)
    .sort(rankCandidate);

  return dedupeCandidates(candidates);
}

export function isPlausibleSessionTab(tab: CandidateTabInput, session: WorkspaceSession): boolean {
  return toCandidate(tab, session) !== null;
}

function toCandidate(tab: CandidateTabInput, session: WorkspaceSession): PlausibleTabCandidate | null {
  if (typeof tab.id !== 'number' || !tab.url) {
    return null;
  }

  const target = session.insertionTarget ?? session.latestContext.composeTarget;
  const matchReason = getMatchReason(tab.url, session, target);

  if (!matchReason) {
    return null;
  }

  return {
    tabId: tab.id,
    windowId: tab.windowId,
    title: tab.title || undefined,
    url: tab.url,
    origin: getOrigin(tab.url),
    active: tab.active,
    currentWindow: tab.currentWindow,
    matchReason,
  };
}

function getMatchReason(
  tabUrl: string,
  session: WorkspaceSession,
  target: WorkspaceSession['insertionTarget'],
): PlausibleTabMatchReason | null {
  if (target?.pageUrl && tabUrl === target.pageUrl) {
    return 'target_url';
  }

  if (target?.origin && isSameOrigin(tabUrl, target.origin)) {
    return 'target_origin';
  }

  if (tabUrl === session.pageUrl) {
    return 'session_url';
  }

  return null;
}

function rankCandidate(a: PlausibleTabCandidate, b: PlausibleTabCandidate): number {
  return scoreCandidate(b) - scoreCandidate(a)
    || (a.title ?? '').localeCompare(b.title ?? '')
    || a.tabId - b.tabId;
}

function scoreCandidate(candidate: PlausibleTabCandidate): number {
  const reasonScore = candidate.matchReason === 'target_url'
    ? 30
    : candidate.matchReason === 'target_origin'
      ? 20
      : 10;
  const activeScore = candidate.active ? 4 : 0;
  const windowScore = candidate.currentWindow ? 2 : 0;
  return reasonScore + activeScore + windowScore;
}

function dedupeCandidates(candidates: PlausibleTabCandidate[]): PlausibleTabCandidate[] {
  const seen = new Set<number>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.tabId)) {
      return false;
    }

    seen.add(candidate.tabId);
    return true;
  });
}

function isSameOrigin(tabUrl: string, origin: string): boolean {
  try {
    return new URL(tabUrl).origin === origin;
  } catch {
    return tabUrl.startsWith(`${origin}/`);
  }
}

function getOrigin(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}
