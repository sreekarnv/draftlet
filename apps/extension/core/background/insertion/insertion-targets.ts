import type { WorkspaceSession } from '../../messages';
import { findPlausibleTabCandidates, isPlausibleSessionTab } from '../../tab-disambiguation';
import { sessions } from '../state';
import { emitWorkspaceSessionUpdated } from '../shared-helpers';
import type { InsertionTabResolution } from './insertion-types';

export async function resolveRecaptureTab(session: WorkspaceSession, tabId?: number): Promise<InsertionTabResolution> {
  if (typeof tabId === 'number') {
    const tab = await browser.tabs.get(tabId).catch(() => null);

    if (tab?.id && isPlausibleSessionTab(tab, session)) {
      return { status: 'resolved', tab: bindSessionToTab(session, tab) };
    }

    return { status: 'missing' };
  }

  const { getActiveTab } = await import('../shared-helpers');
  const activeTab = await getActiveTab().catch(() => null);

  if (activeTab?.id && isPlausibleSessionTab(activeTab, session)) {
    return { status: 'resolved', tab: bindSessionToTab(session, activeTab) };
  }

  return resolveInsertionTab(session);
}

export async function resolveInsertionTab(session: WorkspaceSession): Promise<InsertionTabResolution> {
  const shouldDisambiguate = session.insertionTargetStatus === 'stale'
    || session.insertionTargetStatus === 'tab_disambiguation_required';

  if (!shouldDisambiguate && session.tabId >= 0) {
    const tab = await browser.tabs.get(session.tabId).catch(() => null);

    if (tab && isPlausibleSessionTab(tab, session)) {
      return { status: 'resolved', tab };
    }
  }

  const tabs = await browser.tabs.query({}).catch(() => []);
  const candidates = findPlausibleTabCandidates(tabs, session);

  if (candidates.length > 1) {
    return { status: 'ambiguous', candidates };
  }

  const candidate = candidates[0];

  if (!candidate) {
    return { status: 'missing' };
  }

  const tab = tabs.find((item) => item.id === candidate.tabId);

  if (!tab?.id) {
    return { status: 'missing' };
  }

  return { status: 'resolved', tab: bindSessionToTab(session, tab) };
}

export function bindSessionToTab(session: WorkspaceSession, tab: Browser.tabs.Tab): Browser.tabs.Tab {
  if (!tab.id) {
    return tab;
  }

  const updated = sessions.hydrateSession({
    ...session,
    tabId: tab.id,
    windowId: tab.windowId,
    plausibleTabs: undefined,
    latestContext: {
      ...session.latestContext,
      tabId: tab.id,
      windowId: tab.windowId,
    },
  });
  void emitWorkspaceSessionUpdated(updated);
  return tab;
}

export async function ensureInsertionTabActive(tab: Browser.tabs.Tab): Promise<void> {
  if (typeof tab.windowId === 'number') {
    try {
      const window = await browser.windows.get(tab.windowId).catch(() => null);
      if (window && !window.focused) {
        await browser.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
      }
    } catch {
      // Ignore - tab/window activation is best-effort.
    }
  }

  if (typeof tab.id === 'number' && !tab.active) {
    await browser.tabs.update(tab.id, { active: true }).catch(() => undefined);
  }
}

export async function handleActivateInsertionTab(sessionId: string): Promise<void> {
  const session = sessions.getBySessionId(sessionId);
  if (!session || typeof session.tabId !== 'number') {
    return;
  }

  const tab = await browser.tabs.get(session.tabId).catch(() => null);
  if (!tab?.id || !isPlausibleSessionTab(tab, session)) {
    return;
  }

  await ensureInsertionTabActive(tab);
}
