import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  claimGenerationRun,
  getGenerationRunExecutionState,
  heartbeatGenerationRun,
  reconcileGenerationRuns,
  streamReplies,
} from '../../core/api';
import type { ReplyRequestPayload } from '../../core/types';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('streamReplies', () => {
  it('maps runtime draft_variant events into streamed draft variant metadata', async () => {
    const received: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn(async () => createStreamResponse([
      'event: draft_variant\n',
      'data: {"reply":"Domain draft","variant_id":"variant-1","thread_id":"thread-1","turn_id":"turn-1"}\n\n',
    ])));

    await streamReplies(payload(), {
      onReply(variant) {
        received.push(variant);
      },
    });

    expect(received).toEqual([
      {
        text: 'Domain draft',
        variantId: 'variant-1',
      },
    ]);
  });
});

describe('generation run runtime API', () => {
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
