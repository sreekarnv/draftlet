export interface SseMessage {
  data: string;
  eventType?: string;
  id?: string;
}

interface StreamSseOptions {
  url: string;
  init?: RequestInit;
  signal?: AbortSignal;
  onMessage: (message: SseMessage) => void;
}

export async function streamSse({ url, init, signal, onMessage }: StreamSseOptions): Promise<void> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'text/event-stream',
      ...init?.headers,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Streaming response did not include a body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    buffer = flushCompleteEvents(buffer, onMessage);
  }

  buffer += decoder.decode().replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (buffer.trim()) {
    dispatchEventBlock(buffer, onMessage);
  }
}

function flushCompleteEvents(buffer: string, onMessage: (message: SseMessage) => void): string {
  let nextBoundary = buffer.indexOf('\n\n');

  while (nextBoundary >= 0) {
    const block = buffer.slice(0, nextBoundary);
    dispatchEventBlock(block, onMessage);
    buffer = buffer.slice(nextBoundary + 2);
    nextBoundary = buffer.indexOf('\n\n');
  }

  return buffer;
}

function dispatchEventBlock(block: string, onMessage: (message: SseMessage) => void) {
  const lines = block.split('\n');
  const eventType = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
  const id = lines.find((line) => line.startsWith('id:'))?.slice(3).trim();
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) {
    return;
  }

  const data = dataLines.join('\n');

  if (eventType === 'error') {
    throw new Error(data || 'SSE stream failed.');
  }

  onMessage({ data, eventType, id });
}
