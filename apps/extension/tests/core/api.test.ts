import { afterEach, describe, expect, it, vi } from 'vitest';

import { streamReplies } from '../../core/api';
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
