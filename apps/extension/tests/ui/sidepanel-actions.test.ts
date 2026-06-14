import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACTIVATE_RECAPTURE_TAB,
  CANCEL_DRAFT_GENERATION,
  GET_DOMAIN_HISTORY,
  GET_RUNTIME_STATUS,
  RESTORE_DOMAIN_THREAD,
  START_DRAFT_GENERATION,
  type DraftletMessage,
  type WorkspaceSession,
} from '../../core/messages';
import { MAX_RECAPTURE_TRAIL_ITEMS, createInitialState } from '../../ui/sidepanel/state';
import type { PanelController } from '../../ui/mount-panel';
import {
  activateRecaptureTab,
  appendTrail,
  cancelActiveGeneration,
  configureSendMessage,
  loadDomainHistory,
  recaptureInsertionTarget,
  refreshHealth,
  restoreDomainHistoryItem,
  startDraftGenerationFromCurrentSession,
  trailEventForRecapture,
  trailLevelForRecapture,
} from '../../ui/sidepanel/actions';
import type { SendMessage } from '../../ui/sidepanel/runtime-message-bus';
import type { ConnectionStatus, InsertionTargetStatus, PanelState } from '../../core/types';

interface PanelCall {
  method: keyof PanelController;
  args: unknown[];
}

function createPanelStub(): { controller: PanelController; calls: PanelCall[] } {
  const calls: PanelCall[] = [];
  const record = (method: keyof PanelController) =>
    vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
    });

  const controller: PanelController = {
    open: record('open'),
    setTone: record('setTone'),
    getTone: () => 'professional',
    setActiveView: record('setActiveView'),
    getActiveView: () => 'replies',
    setConnectionStatus: record('setConnectionStatus') as unknown as (status: ConnectionStatus) => void,
    setInsertionTargetStatus: record('setInsertionTargetStatus'),
    setRestoreState: record('setRestoreState'),
    setState: record('setState') as unknown as (state: PanelState, message?: string) => void,
    setThreadSnapshot: record('setThreadSnapshot'),
    subscribe: () => () => {},
  };

  return { controller, calls };
}

function workspaceSession(overrides: Partial<WorkspaceSession> = {}): WorkspaceSession {
  return {
    sessionId: 'session-1',
    tabId: 10,
    windowId: 1,
    pageUrl: 'https://mail.example.com/thread/1',
    pageTitle: 'Thread',
    latestContext: {
      selectedText: 'Please reply to this thread.',
      sourceUrl: 'https://mail.example.com/thread/1',
      sourceDomain: 'mail.example.com',
      pageTitle: 'Thread',
      tone: 'friendly',
      activeView: 'replies',
    },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:01.000Z',
    ...overrides,
  };
}

function messagesOfType<T extends DraftletMessage['type']>(
  sent: DraftletMessage[],
  type: T,
): Extract<DraftletMessage, { type: T }>[] {
  return sent.filter((message) => message.type === type) as Extract<DraftletMessage, { type: T }>[];
}

let sent: DraftletMessage[];
let sendMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sent = [];
  sendMock = vi.fn(async (message: DraftletMessage) => {
    sent.push(message);
    return undefined;
  });
  configureSendMessage(sendMock as unknown as SendMessage);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('appendTrail', () => {
  it('appends a bounded trail item with a timestamp', () => {
    const next = appendTrail([], 'recapture_requested', 'pending', 'Recapture requested.', 7);

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      event: 'recapture_requested',
      level: 'pending',
      message: 'Recapture requested.',
      tabId: 7,
    });
    expect(typeof next[0].at).toBe('string');
    expect(Date.parse(next[0].at)).not.toBeNaN();
  });

  it('keeps only the latest items when over the maximum', () => {
    let trail: ReturnType<typeof appendTrail> = [];
    for (let i = 0; i < MAX_RECAPTURE_TRAIL_ITEMS + 2; i += 1) {
      trail = appendTrail(trail, 'recapture_requested', 'pending', `step ${i}`, i);
    }

    expect(trail).toHaveLength(MAX_RECAPTURE_TRAIL_ITEMS);
    expect(trail[0]).toMatchObject({ tabId: 2, message: 'step 2' });
    expect(trail.at(-1)).toMatchObject({ tabId: MAX_RECAPTURE_TRAIL_ITEMS + 1, message: `step ${MAX_RECAPTURE_TRAIL_ITEMS + 1}` });
  });
});

describe('trailEventForRecapture / trailLevelForRecapture', () => {
  it('maps recapture_succeeded to a success trail entry', () => {
    expect(trailEventForRecapture({ outcome: 'recapture_succeeded' } as never)).toBe('recapture_succeeded');
    expect(trailLevelForRecapture({ outcome: 'recapture_succeeded' } as never)).toBe('success');
  });

  it('maps focus and tab-choice outcomes to focus_required warning', () => {
    expect(trailEventForRecapture({ outcome: 'needs_focused_compose_target' } as never)).toBe('focus_required');
    expect(trailEventForRecapture({ outcome: 'tab_choice_acknowledged' } as never)).toBe('focus_required');
    expect(trailLevelForRecapture({ outcome: 'needs_focused_compose_target' } as never)).toBe('warning');
    expect(trailLevelForRecapture({ outcome: 'tab_choice_acknowledged' } as never)).toBe('warning');
  });

  it('falls back to recapture_failed for any other outcome', () => {
    expect(trailEventForRecapture({ outcome: 'recapture_failed' } as never)).toBe('recapture_failed');
    expect(trailLevelForRecapture({ outcome: 'recapture_failed' } as never)).toBe('failed');
    expect(trailEventForRecapture({ outcome: 'chosen_tab_unavailable' } as never)).toBe('recapture_failed');
    expect(trailLevelForRecapture({ outcome: 'chosen_tab_unavailable' } as never)).toBe('failed');
  });
});

describe('startDraftGenerationFromCurrentSession', () => {
  it('rejects when no current session is set', async () => {
    const { controller } = createPanelStub();
    const state = createInitialState('professional', 'replies');

    const result = await startDraftGenerationFromCurrentSession(state, controller);

    expect(result).toEqual({ ok: false, message: 'Select text on a page before generating replies.' });
    expect(controller.setState).toHaveBeenLastCalledWith('error', 'Select text on a page before generating replies.');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('starts a draft generation and updates the active run on success', async () => {
    const { controller } = createPanelStub();
    const state = createInitialState('friendly', 'replies');
    state.currentSession = workspaceSession();

    sendMock.mockImplementationOnce(async (message) => {
      sent.push(message);
      return {
        started: true,
        sessionId: 'session-1',
        generationId: 'generation-1',
        threadId: 'thread-1',
        turnId: 'turn-1',
      };
    });

    const result = await startDraftGenerationFromCurrentSession(state, controller, {
      successMessage: 'Started draft generation.',
    });

    expect(result).toEqual({ ok: true, message: 'Started draft generation.' });
    const startMessages = messagesOfType(sent, START_DRAFT_GENERATION);
    expect(startMessages).toHaveLength(1);
    expect(startMessages[0]).toMatchObject({
      type: START_DRAFT_GENERATION,
      sessionId: 'session-1',
      tone: 'friendly',
      activeView: 'replies',
    });
    expect(state.currentSession?.activeRunId).toBe('generation-1');
    expect(state.currentSession?.activeThreadId).toBe('thread-1');
    expect(state.currentSession?.activeTurnId).toBe('turn-1');
  });

  it('uses the start error message from the background response when generation does not start', async () => {
    const { controller } = createPanelStub();
    const state = createInitialState('professional', 'replies');
    state.currentSession = workspaceSession();

    sendMock.mockImplementationOnce(async (message) => {
      sent.push(message);
      return {
        started: false,
        error: { code: 'missing_context', message: 'Choose a focused compose field first.', retryable: true },
      };
    });

    const result = await startDraftGenerationFromCurrentSession(state, controller);

    expect(result.ok).toBe(false);
    expect(result.message).toBe('Choose a focused compose field first.');
    expect(controller.setState).toHaveBeenLastCalledWith('error', 'Choose a focused compose field first.');
    expect(state.currentSession?.activeRunId).toBeUndefined();
  });

  it('marks the panel disconnected when the background rejects', async () => {
    const { controller } = createPanelStub();
    const state = createInitialState('professional', 'replies');
    state.currentSession = workspaceSession();

    sendMock.mockImplementationOnce(async () => {
      throw new Error('connection refused');
    });

    const result = await startDraftGenerationFromCurrentSession(state, controller);

    expect(result.ok).toBe(false);
    expect(result.message).toBe('connection refused');
    expect(controller.setConnectionStatus).toHaveBeenLastCalledWith('disconnected');
    expect(controller.setState).toHaveBeenLastCalledWith('error', 'connection refused');
  });
});

describe('cancelActiveGeneration', () => {
  it('sends a cancel message and clears the local active run id', async () => {
    const state = createInitialState('professional', 'replies');
    state.currentSession = workspaceSession({ activeRunId: 'generation-1' });

    await cancelActiveGeneration(state);

    const cancelMessages = messagesOfType(sent, CANCEL_DRAFT_GENERATION);
    expect(cancelMessages).toHaveLength(1);
    expect(cancelMessages[0]).toMatchObject({
      type: CANCEL_DRAFT_GENERATION,
      sessionId: 'session-1',
      generationId: 'generation-1',
    });
    expect(state.currentSession?.activeRunId).toBeUndefined();
  });

  it('is a no-op when no active run is in flight', async () => {
    const state = createInitialState('professional', 'replies');
    state.currentSession = workspaceSession();

    await cancelActiveGeneration(state);

    expect(sendMock).not.toHaveBeenCalled();
  });

  it('swallows send rejections so cancellation never surfaces an error', async () => {
    const state = createInitialState('professional', 'replies');
    state.currentSession = workspaceSession({ activeRunId: 'generation-1' });

    sendMock.mockImplementationOnce(async () => {
      throw new Error('busy');
    });

    await expect(cancelActiveGeneration(state)).resolves.toBeUndefined();
    expect(state.currentSession?.activeRunId).toBeUndefined();
  });
});

describe('refreshHealth', () => {
  it('marks the panel connected when the runtime reports connected', async () => {
    const { controller } = createPanelStub();
    const state = createInitialState('professional', 'replies');

    sendMock.mockImplementationOnce(async (message) => {
      sent.push(message);
      return { status: 'connected' };
    });

    const connected = await refreshHealth(state, controller);

    expect(connected).toBe(true);
    expect(controller.setConnectionStatus).toHaveBeenLastCalledWith('connected');
    expect(messagesOfType(sent, GET_RUNTIME_STATUS)).toHaveLength(1);
  });

  it('marks the panel disconnected when the runtime reports disconnected', async () => {
    const { controller } = createPanelStub();
    const state = createInitialState('professional', 'replies');

    sendMock.mockImplementationOnce(async (message) => {
      sent.push(message);
      return { status: 'disconnected' };
    });

    const connected = await refreshHealth(state, controller);

    expect(connected).toBe(false);
    expect(controller.setConnectionStatus).toHaveBeenLastCalledWith('disconnected');
  });

  it('marks the panel disconnected and returns false when send rejects', async () => {
    const { controller } = createPanelStub();
    const state = createInitialState('professional', 'replies');

    sendMock.mockImplementationOnce(async () => {
      throw new Error('busy');
    });

    const connected = await refreshHealth(state, controller);

    expect(connected).toBe(false);
    expect(controller.setConnectionStatus).toHaveBeenLastCalledWith('disconnected');
  });
});

describe('loadDomainHistory', () => {
  it('returns history items and leaves the connection status untouched on success', async () => {
    const { controller } = createPanelStub();
    const state = createInitialState('professional', 'replies');

    const items = [{ session: workspaceSession(), thread: { thread: { threadId: 't' } } } as never];
    sendMock.mockImplementationOnce(async (message) => {
      sent.push(message);
      return { items };
    });

    const result = await loadDomainHistory(state, controller);

    expect(result).toBe(items);
    expect(messagesOfType(sent, GET_DOMAIN_HISTORY)).toHaveLength(1);
    expect((messagesOfType(sent, GET_DOMAIN_HISTORY)[0] as { limit?: number }).limit).toBe(20);
  });

  it('marks the panel disconnected and rethrows when the response carries an error', async () => {
    const { controller } = createPanelStub();
    const state = createInitialState('professional', 'replies');

    sendMock.mockImplementationOnce(async (message) => {
      sent.push(message);
      return { items: [], error: { code: 'unavailable', message: 'Server offline', retryable: true } };
    });

    await expect(loadDomainHistory(state, controller)).rejects.toThrow('Server offline');
    expect(controller.setConnectionStatus).toHaveBeenLastCalledWith('disconnected');
  });

  it('rethrows and marks the panel disconnected when send rejects', async () => {
    const { controller } = createPanelStub();
    const state = createInitialState('professional', 'replies');

    sendMock.mockImplementationOnce(async () => {
      throw new Error('socket closed');
    });

    await expect(loadDomainHistory(state, controller)).rejects.toThrow('socket closed');
    expect(controller.setConnectionStatus).toHaveBeenLastCalledWith('disconnected');
  });
});

describe('restoreDomainHistoryItem', () => {
  it('applies the restored session and thread and reports success', async () => {
    const { controller } = createPanelStub();
    const state = createInitialState('professional', 'replies');
    const restoredSession = workspaceSession();
    const restoredThread = {
      thread: { threadId: 'thread-restored' },
      turns: [],
      variants: [],
    } as never;
    const item = { session: restoredSession, thread: { thread: { threadId: 'thread-restored' } } } as never;

    sendMock.mockImplementationOnce(async (message) => {
      sent.push(message);
      return {
        restored: true,
        session: restoredSession,
        thread: restoredThread,
      };
    });

    const result = await restoreDomainHistoryItem(state, controller, item);

    expect(result).toEqual({ ok: true, message: 'Restored this thread.' });
    const restoreMessages = messagesOfType(sent, RESTORE_DOMAIN_THREAD);
    expect(restoreMessages).toHaveLength(1);
    expect(restoreMessages[0]).toMatchObject({
      type: RESTORE_DOMAIN_THREAD,
      sessionId: 'session-1',
      threadId: 'thread-restored',
    });
    expect(controller.setActiveView).toHaveBeenLastCalledWith('replies');
  });

  it('returns a failure when the background reports an un-restoreable thread', async () => {
    const { controller } = createPanelStub();
    const state = createInitialState('professional', 'replies');
    const item = { session: workspaceSession(), thread: { thread: { threadId: 'thread-missing' } } } as never;

    sendMock.mockImplementationOnce(async (message) => {
      sent.push(message);
      return {
        restored: false,
        error: { code: 'domain_thread_not_found', message: 'Thread not found.', retryable: true },
      };
    });

    const result = await restoreDomainHistoryItem(state, controller, item);

    expect(result.ok).toBe(false);
    expect(result.message).toBe('Thread not found.');
    expect(controller.setActiveView).not.toHaveBeenCalled();
  });
});

describe('recaptureInsertionTarget', () => {
  it('returns a failure with trail diagnostics when no session is active', async () => {
    const { controller } = createPanelStub();
    const state = createInitialState('professional', 'replies');

    const result = await recaptureInsertionTarget(state, controller);

    expect(result.ok).toBe(false);
    expect(result.message).toBe('No active Draftlet session.');
    expect(state.recaptureTrail).toHaveLength(1);
    expect(state.recaptureTrail[0]).toMatchObject({
      event: 'recapture_failed',
      level: 'failed',
      message: 'Recapture failed: no active session.',
    });
  });

  it('captures the request in the trail and updates the session on success', async () => {
    const { controller } = createPanelStub();
    const state = createInitialState('professional', 'replies');
    state.currentSession = workspaceSession();

    const target = {
      targetId: 'compose-1',
      kind: 'textarea',
      pageUrl: 'https://mail.example.com/thread/1',
      fingerprint: 'textarea|reply',
      lastSeenAt: '2026-01-01T00:00:00.000Z',
    };

    sendMock.mockImplementationOnce(async (message) => {
      sent.push(message);
      return {
        recaptured: true,
        status: 'live' as InsertionTargetStatus,
        outcome: 'recapture_succeeded',
        target,
        message: 'Recaptured.',
      };
    });

    const result = await recaptureInsertionTarget(state, controller);

    expect(result.ok).toBe(true);
    expect(result.message).toBe('Recaptured.');
    expect(state.currentSession?.insertionTargetStatus).toBe('live');
    expect(state.currentSession?.insertionTarget).toEqual(target);
    expect(state.recaptureTrail).toHaveLength(2);
    expect(state.recaptureTrail[0]).toMatchObject({ event: 'recapture_requested', level: 'pending' });
    expect(state.recaptureTrail[1]).toMatchObject({ event: 'recapture_succeeded', level: 'success' });
  });

  it('surfaces a failure message and unavailable status when send rejects', async () => {
    const { controller } = createPanelStub();
    const state = createInitialState('professional', 'replies');
    state.currentSession = workspaceSession();

    sendMock.mockImplementationOnce(async () => {
      throw new Error('offline');
    });

    const result = await recaptureInsertionTarget(state, controller);

    expect(result.ok).toBe(false);
    expect(result.message).toBe('Draftlet could not recapture the target. Copy still works.');
    expect(state.currentSession?.insertionTargetStatus).toBe('unavailable');
    expect(state.recaptureTrail.at(-1)).toMatchObject({ event: 'recapture_failed', level: 'failed' });
  });
});

describe('activateRecaptureTab', () => {
  it('sends a tab activation message and marks the session for focus on success', async () => {
    const { controller } = createPanelStub();
    const state = createInitialState('professional', 'replies');
    state.currentSession = workspaceSession();

    sendMock.mockImplementationOnce(async (message) => {
      sent.push(message);
      return { activated: true, message: 'Tab opened.' };
    });

    const result = await activateRecaptureTab(state, controller, 42);

    expect(result.ok).toBe(true);
    expect(result.message).toBe('Tab opened.');
    expect(sent.find((m) => m.type === ACTIVATE_RECAPTURE_TAB)).toMatchObject({
      type: ACTIVATE_RECAPTURE_TAB,
      sessionId: 'session-1',
      tabId: 42,
    });
    expect(state.currentSession?.insertionTargetStatus).toBe('needs_focus');
    expect(state.recaptureTrail).toHaveLength(2);
  });

  it('returns failure when no session is set', async () => {
    const { controller } = createPanelStub();
    const state = createInitialState('professional', 'replies');

    const result = await activateRecaptureTab(state, controller, 42);

    expect(result.ok).toBe(false);
    expect(result.message).toBe('No active Draftlet session.');
    expect(sendMock).not.toHaveBeenCalled();
  });
});
