import { afterEach, describe, expect, it, vi } from 'vitest';

import { streamSse } from '../../core/sse-client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('streamSse', () => {
  it('parses chunked events with ids and multiline data', async () => {
    const messages: Array<{ data: string; id?: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async () => createStreamResponse([
      'id: 101\ndata: First',
      ' line\n',
      'data: second line\n\n',
      'id: 102\ndata: Second reply\n\n',
    ])));

    await streamSse({
      url: 'http://127.0.0.1:47632/replies',
      onMessage(message) {
        messages.push({ data: message.data, id: message.id });
      },
    });

    expect(messages).toEqual([
      { id: '101', data: 'First line\nsecond line' },
      { id: '102', data: 'Second reply' },
    ]);
  });

  it('flushes a final event without a trailing blank line', async () => {
    const messages: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async () => createStreamResponse(['data: Final reply'])));

    await streamSse({
      url: 'http://127.0.0.1:47632/replies',
      onMessage(message) {
        messages.push(message.data);
      },
    });

    expect(messages).toEqual(['Final reply']);
  });

  it('throws when the stream emits an error event', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => createStreamResponse(['event: error\ndata: Ollama is unavailable\n\n'])));

    await expect(streamSse({
      url: 'http://127.0.0.1:47632/replies',
      onMessage() {},
    })).rejects.toThrow('Ollama is unavailable');
  });

  it('throws on non-ok responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })));

    await expect(streamSse({
      url: 'http://127.0.0.1:47632/replies',
      onMessage() {},
    })).rejects.toThrow('Request failed with 500');
  });
});

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
