import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cancelReplyGenerationRunExecution,
  claimGenerationRun,
  getConversationThreadSnapshot,
  getGenerationRunExecutionState,
  getGenerationRunProgress,
  heartbeatGenerationRun,
  putWorkspaceSession,
  reconcileGenerationRuns,
  startReplyGenerationRunExecution,
  streamReplyGenerationRunEvents,
} from '../../core/api';
import type { ReplyRequestPayload } from '../../core/types';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('streamReplyGenerationRunEvents', () => {
  it('maps runtime replay event ids into streamed draft variant sequences', async () => {
    const received: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async () => createStreamResponse([
      'id: 2\n',
      'event: variant_persisted\n',
      'data: {"reply":"Replayed draft","variant_id":"variant-2","thread_id":"thread-1","turn_id":"turn-1"}\n\n',
      'id: 3\n',
      'event: run_completed\n',
      'data: run_completed\n\n',
    ])));

    await streamReplyGenerationRunEvents('generation-1', {
      afterSequence: 1,
      onReply(variant) {
        received.push(variant);
      },
    });

    expect(received).toEqual([
      {
        text: 'Replayed draft',
        variantId: 'variant-2',
        sequence: 2,
      },
    ]);
  });

  it('maps runtime control events into run status metadata', async () => {
    const received: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async () => createStreamResponse([
      'id: 1\n',
      'event: run_started\n',
      'data: run_started\n\n',
      'id: 2\n',
      'event: run_completed\n',
      'data: run_completed\n\n',
    ])));

    await streamReplyGenerationRunEvents('generation-1', {
      onReply() {},
      onControl(event) {
        received.push(event);
      },
    });

    expect(received).toEqual([
      { status: 'run_started', message: 'run_started', sequence: 1 },
      { status: 'run_completed', message: 'run_completed', sequence: 2 },
    ]);
  });
});

describe('workspace session runtime API', () => {
  it('persists and maps active routing metadata', async () => {
    const fetchMock = vi.fn(async () => Response.json(workspaceSessionRead()));
    vi.stubGlobal('fetch', fetchMock);

    const session = await putWorkspaceSession({
      sessionId: 'session-1',
      tabId: 10,
      windowId: 1,
      pageUrl: 'https://example.com/thread',
      pageTitle: 'Inbox',
      latestContext: {
        selectedText: 'Please reply to this.',
        sourceUrl: 'https://example.com/thread',
        sourceDomain: 'example.com',
        pageTitle: 'Inbox',
      },
      status: 'active',
      activeThreadId: 'thread-1',
      activeTurnId: 'turn-1',
      activeRunId: 'generation-1',
      createdAt: '2026-06-09T00:00:00.000Z',
      updatedAt: '2026-06-09T00:00:01.000Z',
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/domain/sessions/session-1'), expect.objectContaining({
      method: 'PUT',
      body: expect.stringContaining('"active_run_id":"generation-1"'),
    }));
    expect(session).toMatchObject({
      activeThreadId: 'thread-1',
      activeTurnId: 'turn-1',
      activeRunId: 'generation-1',
    });
  });
});

describe('generation run runtime API', () => {
  it('starts a runtime-owned reply execution by run id', async () => {
    const fetchMock = vi.fn(async () => Response.json({ run_id: 'generation-1', started: true, live: true }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await startReplyGenerationRunExecution('generation-1', payload());

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/replies/generation-1/start'), expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"run_id":"generation-1"'),
    }));
    expect(result).toEqual({ runId: 'generation-1', started: true, live: true });
  });

  it('cancels a runtime-owned reply execution by run id', async () => {
    const fetchMock = vi.fn(async () => Response.json({ cancelled: true }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await cancelReplyGenerationRunExecution('generation-1');

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/replies/generation-1/cancel'), expect.objectContaining({
      method: 'POST',
    }));
    expect(result).toEqual({ cancelled: true });
  });

  it('claims and maps a runtime generation run', async () => {
    const fetchMock = vi.fn(async () => Response.json(generationRunRead({ status: 'active' })));
    vi.stubGlobal('fetch', fetchMock);

    const run = await claimGenerationRun({
      runId: 'generation-1',
      sessionId: 'session-1',
      threadId: 'thread-1',
      turnId: 'turn-1',
      leaseOwner: 'extension-background',
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/domain/generation-runs/generation-1'), expect.objectContaining({
      method: 'PUT',
    }));
    expect(run).toMatchObject({
      runId: 'generation-1',
      sessionId: 'session-1',
      threadId: 'thread-1',
      turnId: 'turn-1',
      status: 'active',
      leaseOwner: 'extension-background',
    });
  });

  it('requests runtime reconciliation for stale generation runs', async () => {
    const fetchMock = vi.fn(async () => Response.json([generationRunRead({ status: 'interrupted' })]));
    vi.stubGlobal('fetch', fetchMock);

    const runs = await reconcileGenerationRuns({
      sessionId: 'session-1',
      staleAfterSeconds: 0,
      error: {
        code: 'generation_interrupted',
        message: 'Draft generation was interrupted before completion.',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/domain/generation-runs/reconcile'), expect.objectContaining({
      method: 'POST',
    }));
    expect(runs[0]).toMatchObject({
      runId: 'generation-1',
      status: 'interrupted',
    });
  });

  it('heartbeats a runtime generation run lease', async () => {
    const fetchMock = vi.fn(async () => Response.json(generationRunRead({ status: 'streaming' })));
    vi.stubGlobal('fetch', fetchMock);

    const run = await heartbeatGenerationRun('generation-1', 'extension-background');

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/domain/generation-runs/generation-1/heartbeat'), expect.objectContaining({
      method: 'PATCH',
    }));
    expect(run).toMatchObject({
      runId: 'generation-1',
      status: 'streaming',
      leaseOwner: 'extension-background',
    });
  });

  it('queries runtime generation execution state', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      checked_at: '2026-06-09T00:00:02.000Z',
      stale_after_seconds: 30,
      active: [generationRunRead({ status: 'streaming' })],
      live: [generationRunRead({ status: 'streaming' })],
      stale: [],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const state = await getGenerationRunExecutionState({
      sessionId: 'session-1',
      staleAfterSeconds: 30,
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/domain/generation-runs/execution-state?'), expect.any(Object));
    expect(state.live[0]).toMatchObject({
      runId: 'generation-1',
      status: 'streaming',
    });
    expect(state.stale).toEqual([]);
  });

  it('queries runtime generation progress snapshots', async () => {
    const fetchMock = vi.fn(async () => Response.json(generationRunProgressRead()));
    vi.stubGlobal('fetch', fetchMock);

    const progress = await getGenerationRunProgress('generation-1', {
      afterSequence: 100,
      limit: 20,
    });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/domain/generation-runs/generation-1/progress?'), expect.any(Object));
    expect(progress).toMatchObject({
      run: {
        runId: 'generation-1',
        status: 'streaming',
      },
      replayCursor: 101,
      liveFeedAttachment: {
        mode: 'live_attached',
        liveAttached: true,
        replayAvailable: true,
        subscriberCount: 1,
        reason: 'producer_attached',
      },
      events: [
        {
          sequence: 101,
          eventType: 'draft_variant_generated',
          variantId: 'variant-1',
        },
      ],
    });
    expect(progress?.thread?.variants[0]).toMatchObject({
      variantId: 'variant-1',
      content: 'Domain draft',
    });
  });
});

describe('conversation thread runtime API', () => {
  it('maps latest recoverable run projection from runtime snapshots', async () => {
    const fetchMock = vi.fn(async () => Response.json(conversationThreadSnapshotRead({
      latestRecoverableRun: {
        run_id: 'generation-2',
        turn_id: 'turn-2',
        status: 'interrupted',
        recoverable: true,
        reason: 'generation_interrupted',
        interrupted_at: '2026-06-09T00:00:03.000Z',
        last_event_at: '2026-06-09T00:00:04.000Z',
        error_code: 'generation_interrupted',
        error_message: 'Draft generation was interrupted before completion.',
      },
    })));
    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await getConversationThreadSnapshot('thread-1');

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/domain/threads/thread-1'), expect.any(Object));
    expect(snapshot?.latestRecoverableRun).toEqual({
      runId: 'generation-2',
      turnId: 'turn-2',
      status: 'interrupted',
      recoverable: true,
      reason: 'generation_interrupted',
      interruptedAt: '2026-06-09T00:00:03.000Z',
      lastEventAt: '2026-06-09T00:00:04.000Z',
      errorCode: 'generation_interrupted',
      errorMessage: 'Draft generation was interrupted before completion.',
    });
  });
});

function payload(): ReplyRequestPayload {
  return {
    selected_text: 'Please reply to this.',
    tone: 'friendly',
    source_url: 'https://example.com/thread',
    source_domain: 'example.com',
    session_id: 'session-1',
    thread_id: 'thread-1',
    turn_id: 'turn-1',
    generation_mode: 'initial',
  };
}

function createStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();

  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  }), { status: 200 });
}

function workspaceSessionRead() {
  return {
    session_id: 'session-1',
    tab_id: 10,
    window_id: 1,
    page_url: 'https://example.com/thread',
    page_title: 'Inbox',
    selected_text: 'Please reply to this.',
    source_domain: 'example.com',
    status: 'active',
    active_thread_id: 'thread-1',
    active_turn_id: 'turn-1',
    active_run_id: 'generation-1',
    compose_target: null,
    created_at: '2026-06-09T00:00:00.000Z',
    updated_at: '2026-06-09T00:00:01.000Z',
  };
}

function generationRunRead({ status }: { status: string }) {
  return {
    run_id: 'generation-1',
    session_id: 'session-1',
    thread_id: 'thread-1',
    turn_id: 'turn-1',
    status,
    lease_owner: 'extension-background',
    claimed_at: '2026-06-09T00:00:00.000Z',
    heartbeat_at: '2026-06-09T00:00:00.000Z',
    released_at: status === 'interrupted' ? '2026-06-09T00:00:01.000Z' : null,
    completed_at: null,
    cancelled_at: null,
    interrupted_at: status === 'interrupted' ? '2026-06-09T00:00:01.000Z' : null,
    failed_at: null,
    error_code: status === 'interrupted' ? 'generation_interrupted' : null,
    error_message: status === 'interrupted' ? 'Draft generation was interrupted before completion.' : null,
    created_at: '2026-06-09T00:00:00.000Z',
    updated_at: '2026-06-09T00:00:01.000Z',
  };
}

function generationRunProgressRead() {
  return {
    checked_at: '2026-06-09T00:00:02.000Z',
    run: generationRunRead({ status: 'streaming' }),
    thread: conversationThreadSnapshotRead(),
    events: [
      {
        sequence: 101,
        event_type: 'draft_variant_generated',
        run_id: 'generation-1',
        session_id: 'session-1',
        thread_id: 'thread-1',
        turn_id: 'turn-1',
        status: 'generated',
        variant_id: 'variant-1',
        at: '2026-06-09T00:00:01.000Z',
      },
    ],
    replay_cursor: 101,
    live_feed_attachment: {
      mode: 'live_attached',
      live_attached: true,
      replay_available: true,
      subscriber_count: 1,
      reason: 'producer_attached',
    },
  };
}

function conversationThreadSnapshotRead({
  latestRecoverableRun = null,
}: {
  latestRecoverableRun?: unknown;
} = {}) {
  return {
    thread: {
      thread_id: 'thread-1',
      session_id: 'session-1',
      selected_text: 'Please reply to this.',
      source_url: 'https://example.com/thread',
      source_domain: 'example.com',
      page_title: 'Inbox',
      status: 'active',
      created_at: '2026-06-09T00:00:00.000Z',
      updated_at: '2026-06-09T00:00:01.000Z',
    },
    turns: [
      {
        turn_id: 'turn-1',
        thread_id: 'thread-1',
        instruction: 'Generate reply drafts',
        selected_text: 'Please reply to this.',
        source_url: 'https://example.com/thread',
        source_domain: 'example.com',
        page_title: 'Inbox',
        tone: 'friendly',
        generation_status: 'streaming',
        generation_started_at: '2026-06-09T00:00:00.000Z',
        generation_completed_at: null,
        generation_failed_at: null,
        generation_cancelled_at: null,
        generation_error_code: null,
        generation_error_message: null,
        created_at: '2026-06-09T00:00:00.000Z',
        updated_at: '2026-06-09T00:00:01.000Z',
      },
    ],
    variants: [
      {
        variant_id: 'variant-1',
        turn_id: 'turn-1',
        tone: 'friendly',
        length: null,
        content: 'Domain draft',
        rank: 0,
        status: 'generated',
        is_current: false,
        created_at: '2026-06-09T00:00:01.000Z',
        updated_at: '2026-06-09T00:00:01.000Z',
      },
    ],
    latest_recoverable_run: latestRecoverableRun,
  };
}
