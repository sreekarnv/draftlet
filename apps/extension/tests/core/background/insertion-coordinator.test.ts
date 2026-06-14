import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkspaceSession } from '../../../core/messages';
import {
  handleActivateRecaptureTab,
  handleGetInsertionTargetStatus,
  handleInsertReply,
  handleRecaptureInsertionTarget,
  revalidateInsertionTarget,
} from '../../../core/background/insertion-coordinator';
import { sessions, recaptureDiagnostics } from '../../../core/background/state';

const runtimeApiMocks = vi.hoisted(() => ({
  cancelReplyGenerationRunExecution: vi.fn(),
  checkServerHealth: vi.fn(),
  claimGenerationRun: vi.fn(),
  getActiveGenerationRuns: vi.fn(),
  getConversationThreadSnapshot: vi.fn(),
  getGenerationRunExecutionState: vi.fn(),
  getGenerationRunProgress: vi.fn(),
  getWorkspaceSessionSnapshot: vi.fn(),
  heartbeatGenerationRun: vi.fn(),
  patchDraftVariantState: vi.fn(),
  patchGenerationRunStatus: vi.fn(),
  patchTurnStatus: vi.fn(),
  putConversationThread: vi.fn(),
  putDraftVariant: vi.fn(),
  putTurn: vi.fn(),
  putWorkspaceSession: vi.fn(),
  reconcileGenerationRuns: vi.fn(),
  startReplyGenerationRunExecution: vi.fn(),
  streamReplyGenerationRunEvents: vi.fn(),
}));

vi.mock('../../../core/runtime-api', () => runtimeApiMocks);

function seedSession(options: Partial<WorkspaceSession> = {}): WorkspaceSession {
  const sessionId = options.sessionId ?? 'session-1';
  const tabId = options.tabId ?? 10;
  const context = {
    selectedText: 'Reply to this thread.',
    sourceUrl: 'https://mail.example.com/thread/1',
    sourceDomain: 'mail.example.com',
    pageTitle: 'Thread',
    tabId,
  };
  sessions.upsertFromPageContext({ context, tabId, windowId: 1 });

  const base = sessions.getBySessionId(sessionId) ?? sessions.getByTabId(tabId);
  if (!base) {
    throw new Error('Failed to seed session for tests.');
  }

  const seeded: WorkspaceSession = {
    ...base,
    sessionId,
    pageUrl: options.pageUrl ?? 'https://mail.example.com/thread/1',
    insertionTarget: options.insertionTarget ?? {
      targetId: 'compose-1',
      kind: 'textarea',
      pageUrl: 'https://mail.example.com/thread/1',
      origin: 'https://mail.example.com',
      fingerprint: 'textarea|reply',
      lastSeenAt: '2026-01-01T00:00:00.000Z',
    },
    insertionTargetStatus: options.insertionTargetStatus ?? 'stale',
    activeThreadId: options.activeThreadId ?? 'thread-1',
    activeTurnId: options.activeTurnId ?? 'turn-1',
    plausibleTabs: options.plausibleTabs,
  };

  sessions.hydrateSession(seeded);
  return sessions.getBySessionId(sessionId) ?? seeded;
}

function tab(id: number, url: string, options: { active?: boolean; currentWindow?: boolean; windowId?: number } = {}): Browser.tabs.Tab {
  return {
    id,
    index: 0,
    windowId: options.windowId ?? 1,
    title: `Tab ${id}`,
    url,
    active: options.active ?? false,
    currentWindow: options.currentWindow ?? true,
    pinned: false,
    highlighted: false,
    frozen: false,
    incognito: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
  } as Browser.tabs.Tab;
}

const browserStub = vi.hoisted(() => ({
  runtime: { sendMessage: vi.fn(async () => undefined) },
  tabs: { sendMessage: vi.fn(), get: vi.fn(), update: vi.fn(), query: vi.fn().mockResolvedValue([]) },
  windows: { update: vi.fn(async () => undefined), getCurrent: vi.fn(async () => ({ id: 1 })) },
  sidePanel: { open: vi.fn() },
}));

vi.stubGlobal('browser', browserStub);

beforeEach(() => {
  for (const fn of Object.values(runtimeApiMocks)) {
    fn.mockReset();
  }
  runtimeApiMocks.getWorkspaceSessionSnapshot.mockResolvedValue(null);
  runtimeApiMocks.getGenerationRunProgress.mockResolvedValue(null);
  runtimeApiMocks.getConversationThreadSnapshot.mockResolvedValue(null);
  runtimeApiMocks.patchTurnStatus.mockResolvedValue(undefined);
  runtimeApiMocks.patchGenerationRunStatus.mockResolvedValue(undefined);
  runtimeApiMocks.reconcileGenerationRuns.mockResolvedValue([]);
  runtimeApiMocks.heartbeatGenerationRun.mockResolvedValue(undefined);
  runtimeApiMocks.claimGenerationRun.mockResolvedValue(undefined);
  runtimeApiMocks.startReplyGenerationRunExecution.mockResolvedValue({ runId: 'gen-1', started: true, live: true });
  runtimeApiMocks.streamReplyGenerationRunEvents.mockResolvedValue(undefined);
  runtimeApiMocks.cancelReplyGenerationRunExecution.mockResolvedValue({ cancelled: true });
  runtimeApiMocks.getActiveGenerationRuns.mockResolvedValue([]);
  runtimeApiMocks.getGenerationRunExecutionState.mockResolvedValue(null);

  browserStub.tabs.sendMessage.mockReset();
  browserStub.tabs.get.mockReset();
  browserStub.tabs.update.mockReset();
  browserStub.tabs.query.mockReset();
  browserStub.tabs.query.mockResolvedValue([]);
  browserStub.runtime.sendMessage.mockReset();
  browserStub.runtime.sendMessage.mockResolvedValue(undefined);

  recaptureDiagnostics.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleInsertReply', () => {
  it('inserts into a live target through the content script and returns the content-script result', async () => {
    const session = seedSession({ sessionId: 'session-live-insert', tabId: 30, insertionTargetStatus: 'live' });

    browserStub.tabs.get.mockResolvedValueOnce(tab(30, 'https://mail.example.com/thread/1'));
    browserStub.tabs.sendMessage
      .mockResolvedValueOnce({ status: 'live', message: 'Target available.' })
      .mockResolvedValueOnce({ result: { status: 'inserted', message: 'Inserted.', targetStatus: 'live' } });

    const result = await handleInsertReply('Hello there', session.sessionId);

    expect(result.result.status).toBe('inserted');
    expect(browserStub.tabs.sendMessage).toHaveBeenCalledWith(
      session.tabId,
      expect.objectContaining({
        type: 'draftlet:insert-reply',
        sessionId: session.sessionId,
        replyText: 'Hello there',
      }),
    );
  });

  it('returns a target_stale failure when the revalidation reports stale', async () => {
    const session = seedSession({ sessionId: 'session-stale-insert', tabId: 31, insertionTargetStatus: 'stale' });

    browserStub.tabs.query.mockResolvedValueOnce([
      tab(31, 'https://mail.example.com/thread/1'),
    ]);
    browserStub.tabs.sendMessage.mockResolvedValueOnce({
      status: 'stale',
      message: 'Target stale.',
    });

    const result = await handleInsertReply('Hello', session.sessionId);

    expect(result.result.status).toBe('failed');
    expect(result.result.targetStatus).toBe('stale');
    expect(result.result.errorCode).toBe('target_stale');
  });

  it('returns a session_not_found failure when no session is active', async () => {
    const result = await handleInsertReply('Hello', 'session-missing');

    expect(result.result.status).toBe('failed');
    expect(result.result.targetStatus).toBe('unavailable');
    expect(result.result.errorCode).toBe('session_not_found');
    expect(browserStub.tabs.sendMessage).not.toHaveBeenCalled();
  });
});

describe('revalidateInsertionTarget', () => {
  it('returns unavailable and records a target_revalidation_failed diagnostic when the content script is unreachable', async () => {
    const session = seedSession({ sessionId: 'session-rev-cs', tabId: 32, insertionTargetStatus: 'live' });

    browserStub.tabs.get.mockResolvedValueOnce(tab(32, 'https://mail.example.com/thread/1'));
    browserStub.tabs.sendMessage.mockRejectedValueOnce(new Error('no receiver'));

    const result = await revalidateInsertionTarget(session);

    expect(result.status).toBe('unavailable');
    const lastDiagnostic = recaptureDiagnostics.list({ sessionId: session.sessionId }).at(-1);
    expect(lastDiagnostic).toMatchObject({
      event: 'target_revalidation_failed',
      level: 'error',
      reason: 'content_script_unavailable',
    });
  });

  it('returns tab_disambiguation_required and records a warning when multiple plausible tabs exist', async () => {
    const session = seedSession({ sessionId: 'session-rev-ambiguous', tabId: 33, insertionTargetStatus: 'stale' });

    browserStub.tabs.query.mockResolvedValueOnce([
      tab(50, 'https://mail.example.com/thread/1'),
      tab(51, 'https://mail.example.com/thread/1', { active: true }),
    ]);

    const result = await revalidateInsertionTarget(session);

    expect(result.status).toBe('tab_disambiguation_required');
    expect(result.candidates?.length).toBeGreaterThanOrEqual(2);
    const lastDiagnostic = recaptureDiagnostics.list({ sessionId: session.sessionId }).at(-1);
    expect(lastDiagnostic).toMatchObject({
      event: 'target_revalidation_completed',
      level: 'warning',
      reason: 'tab_disambiguation_required',
    });
  });

  it('returns unavailable when no tab is open for the saved session', async () => {
    const session = seedSession({ sessionId: 'session-rev-missing', tabId: 34, insertionTargetStatus: 'stale' });

    browserStub.tabs.query.mockResolvedValueOnce([]);

    const result = await revalidateInsertionTarget(session);

    expect(result.status).toBe('unavailable');
    const lastDiagnostic = recaptureDiagnostics.list({ sessionId: session.sessionId }).at(-1);
    expect(lastDiagnostic).toMatchObject({
      event: 'target_revalidation_completed',
      level: 'warning',
      reason: 'tab_unavailable',
    });
  });
});

describe('handleGetInsertionTargetStatus', () => {
  it('returns unavailable when no session is active', async () => {
    const result = await handleGetInsertionTargetStatus('session-missing');
    expect(result).toEqual({ status: 'unavailable', message: 'No active Draftlet session.' });
  });

  it('revalidates the active session and surfaces the target status', async () => {
    const session = seedSession({ sessionId: 'session-getstatus', tabId: 35, insertionTargetStatus: 'live' });

    browserStub.tabs.get.mockResolvedValueOnce(tab(35, 'https://mail.example.com/thread/1'));
    browserStub.tabs.sendMessage.mockResolvedValueOnce({
      status: 'live',
      message: 'Target available.',
    });

    const result = await handleGetInsertionTargetStatus(session.sessionId);

    expect(result.status).toBe('live');
    expect(result.message).toBe('Target available.');
  });
});

describe('handleRecaptureInsertionTarget', () => {
  it('returns unavailable when no session is active', async () => {
    const result = await handleRecaptureInsertionTarget('session-missing');

    expect(result.recaptured).toBe(false);
    expect(result.status).toBe('unavailable');
    expect(result.outcome).toBe('recapture_failed');
    expect(result.reason).toBe('session_not_found');
  });

  it('returns tab_disambiguation_required and records a warning when multiple plausible tabs are found', async () => {
    const session = seedSession({ sessionId: 'session-recap-amb', tabId: 36, insertionTargetStatus: 'stale' });

    const allTabs = [
      tab(60, 'https://mail.example.com/thread/1'),
      tab(61, 'https://mail.example.com/thread/1'),
    ];
    browserStub.tabs.query.mockImplementation(async (query?: { active?: boolean; currentWindow?: boolean }) => {
      if (query?.active) {
        return [];
      }
      return allTabs;
    });

    const result = await handleRecaptureInsertionTarget(session.sessionId);

    expect(result.recaptured).toBe(false);
    expect(result.status).toBe('tab_disambiguation_required');
    expect(result.candidates?.length).toBe(2);
    const lastDiagnostic = recaptureDiagnostics.list({ sessionId: session.sessionId }).at(-1);
    expect(lastDiagnostic).toMatchObject({
      event: 'tab_resolution_ambiguous',
      level: 'warning',
      reason: 'tab_disambiguation_required',
    });
  });

  it('returns chosen_tab_unavailable when the selected tab cannot be resolved', async () => {
    const session = seedSession({ sessionId: 'session-recap-missing', tabId: 37, insertionTargetStatus: 'stale' });

    browserStub.tabs.get.mockRejectedValueOnce(new Error('Tab not found.'));

    const result = await handleRecaptureInsertionTarget(session.sessionId, 999);

    expect(result.recaptured).toBe(false);
    expect(result.status).toBe('unavailable');
    expect(result.outcome).toBe('chosen_tab_unavailable');
    expect(result.reason).toBe('tab_unavailable');
    const lastDiagnostic = recaptureDiagnostics.list({ sessionId: session.sessionId }).at(-1);
    expect(lastDiagnostic).toMatchObject({
      event: 'tab_resolution_missing',
      level: 'warning',
      reason: 'tab_unavailable',
    });
  });

  it('returns recapture_failed with content_script_unavailable when the content script cannot be reached', async () => {
    const session = seedSession({ sessionId: 'session-recap-cs', tabId: 38, insertionTargetStatus: 'stale' });

    browserStub.tabs.query.mockResolvedValueOnce([
      tab(38, 'https://mail.example.com/thread/1'),
    ]);
    browserStub.tabs.sendMessage.mockRejectedValueOnce(new Error('no content script'));

    const result = await handleRecaptureInsertionTarget(session.sessionId);

    expect(result.recaptured).toBe(false);
    expect(result.status).toBe('unavailable');
    expect(result.outcome).toBe('recapture_failed');
    expect(result.reason).toBe('content_script_unavailable');
    const lastDiagnostic = recaptureDiagnostics.list({ sessionId: session.sessionId }).at(-1);
    expect(lastDiagnostic).toMatchObject({
      event: 'content_recapture_failed',
      level: 'error',
      reason: 'content_script_unavailable',
    });
  });

  it('records recapture_requested, content_recapture_requested, and content_recapture_completed on success', async () => {
    const session = seedSession({ sessionId: 'session-recap-success', tabId: 39, insertionTargetStatus: 'stale' });

    const updatedTarget = {
      targetId: 'compose-2',
      kind: 'textarea' as const,
      pageUrl: 'https://mail.example.com/thread/1',
      origin: 'https://mail.example.com',
      fingerprint: 'textarea|reply-2',
      lastSeenAt: '2026-01-01T00:01:00.000Z',
    };

    browserStub.tabs.query.mockResolvedValueOnce([
      tab(39, 'https://mail.example.com/thread/1'),
    ]);
    browserStub.tabs.sendMessage.mockResolvedValueOnce({
      recaptured: true,
      status: 'live',
      outcome: 'recapture_succeeded',
      target: updatedTarget,
      message: 'Recaptured.',
    });

    const result = await handleRecaptureInsertionTarget(session.sessionId);

    expect(result.recaptured).toBe(true);
    expect(result.status).toBe('live');
    expect(result.outcome).toBe('recapture_succeeded');

    const events = recaptureDiagnostics.list({ sessionId: session.sessionId }).map((entry) => entry.event);
    expect(events).toContain('recapture_requested');
    expect(events).toContain('content_recapture_requested');
    expect(events).toContain('content_recapture_completed');
  });
});

describe('handleActivateRecaptureTab', () => {
  it('returns session_not_found when no session exists', async () => {
    const result = await handleActivateRecaptureTab('session-missing', 42);

    expect(result.activated).toBe(false);
    expect(result.message).toBe('No active Draftlet session.');
    expect(result.error?.code).toBe('session_not_found');
  });

  it('returns tab_unavailable when the tab cannot be resolved', async () => {
    const session = seedSession({ sessionId: 'session-activate-missing', tabId: 40 });

    browserStub.tabs.get.mockRejectedValueOnce(new Error('Tab not found.'));

    const result = await handleActivateRecaptureTab(session.sessionId, 999);

    expect(result.activated).toBe(false);
    expect(result.error?.code).toBe('tab_unavailable');
  });

  it('activates a plausible tab and returns a success result', async () => {
    const session = seedSession({ sessionId: 'session-activate-ok', tabId: 41 });

    const targetTab = tab(70, 'https://mail.example.com/thread/1');
    browserStub.tabs.get.mockResolvedValueOnce(targetTab);
    browserStub.tabs.update.mockResolvedValueOnce({ ...targetTab, active: true });

    const result = await handleActivateRecaptureTab(session.sessionId, 70);

    expect(result.activated).toBe(true);
    expect(result.tab?.tabId).toBe(70);
    expect(browserStub.tabs.update).toHaveBeenCalledWith(70, { active: true });
  });
});

void {};
