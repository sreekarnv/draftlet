import { SERVER_BASE_URL } from './constants';
import { streamSse } from './sse-client';
import type {
  HistoryGeneration,
  PreferenceItem,
  PreferenceUpsert,
  ReplyRequestPayload,
  StreamedReply,
} from './types';

export async function checkServerHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(`${SERVER_BASE_URL}/health`, {
      headers: { Accept: 'application/json' },
      signal,
    });

    return response.ok;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    return false;
  }
}

interface StreamRepliesOptions {
  signal?: AbortSignal;
  onReply: (reply: StreamedReply) => void;
}

export async function streamReplies(
  payload: ReplyRequestPayload,
  { signal, onReply }: StreamRepliesOptions,
): Promise<void> {
  await streamSse({
    url: `${SERVER_BASE_URL}/replies`,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    signal,
    onMessage(message) {
      const reply = message.data.trim();

      if (reply) {
        onReply({ text: reply, replyId: parseSseId(message.id) });
      }
    },
  });
}

export async function getHistory(signal?: AbortSignal): Promise<HistoryGeneration[]> {
  return getJson<HistoryGeneration[]>(`${SERVER_BASE_URL}/history`, signal);
}


export async function getPreferences(scope?: string, signal?: AbortSignal): Promise<PreferenceItem[]> {
  const query = scope ? `?scope=${encodeURIComponent(scope)}` : '';
  return getJson<PreferenceItem[]>(`${SERVER_BASE_URL}/preferences${query}`, signal);
}

export async function putPreference(preference: PreferenceUpsert): Promise<PreferenceItem> {
  const response = await fetch(`${SERVER_BASE_URL}/preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(preference),
  });

  if (!response.ok) {
    throw new Error(`Preference request failed with ${response.status}`);
  }

  return response.json() as Promise<PreferenceItem>;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function parseSseId(id: string | undefined): number | undefined {
  if (!id) {
    return undefined;
  }

  const value = Number.parseInt(id, 10);
  return Number.isFinite(value) ? value : undefined;
}
