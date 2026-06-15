import { SERVER_BASE_URL } from '../constants';
import { streamSse, type SseMessage } from '../sse-client';
import type { ReplyRequestPayload } from '../types';
import { postJson } from './transport';

export interface StreamedDraftVariant {
  text: string;
  variantId?: string;
  sequence?: number;
}

export interface StreamedGenerationControlEvent {
  status: 'run_started' | 'run_completed' | 'run_cancelled' | 'run_failed';
  message?: string;
  sequence?: number;
}

export interface StreamReplyGenerationRunEventsOptions {
  signal?: AbortSignal;
  onReply: (variant: StreamedDraftVariant) => void;
  onControl?: (event: StreamedGenerationControlEvent) => void;
}

export interface ReplyGenerationRunExecutionStart {
  runId: string;
  started: boolean;
  live: boolean;
}

interface DraftVariantStreamPayload {
  reply: string;
  variant_id: string;
  turn_id?: string | null;
  thread_id?: string | null;
}

interface ReplyGenerationRunExecutionStartRead {
  run_id: string;
  started: boolean;
  live: boolean;
}

function parseStreamedDraftVariant(message: SseMessage): StreamedDraftVariant | null {
  if (message.eventType === 'variant_persisted') {
    try {
      const payload = JSON.parse(message.data) as DraftVariantStreamPayload;
      return {
        text: payload.reply,
        variantId: payload.variant_id,
        sequence: parseSseSequence(message.id),
      };
    } catch {
      return null;
    }
  }

  return null;
}

function parseStreamedGenerationControlEvent(message: SseMessage): StreamedGenerationControlEvent | null {
  if (
    message.eventType !== 'run_started'
    && message.eventType !== 'run_completed'
    && message.eventType !== 'run_cancelled'
    && message.eventType !== 'run_failed'
  ) {
    return null;
  }

  return {
    status: message.eventType,
    message: message.data || undefined,
    sequence: parseSseSequence(message.id),
  };
}

function parseSseSequence(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export async function startReplyGenerationRunExecution(
  runId: string,
  payload: ReplyRequestPayload,
): Promise<ReplyGenerationRunExecutionStart> {
  const response = await postJson<ReplyGenerationRunExecutionStartRead>(
    `${SERVER_BASE_URL}/replies/${encodeURIComponent(runId)}/start`,
    {
      ...payload,
      run_id: runId,
    },
  );

  return {
    runId: response.run_id,
    started: response.started,
    live: response.live,
  };
}

export async function streamReplyGenerationRunEvents(
  runId: string,
  {
    signal,
    afterSequence = 0,
    onReply,
    onControl,
  }: StreamReplyGenerationRunEventsOptions & { afterSequence?: number },
): Promise<void> {
  const query = afterSequence > 0 ? `?after=${encodeURIComponent(String(afterSequence))}` : '';
  await streamSse({
    url: `${SERVER_BASE_URL}/replies/${encodeURIComponent(runId)}/events${query}`,
    signal,
    onMessage(message) {
      const variant = parseStreamedDraftVariant(message);

      if (variant?.text) {
        onReply(variant);
        return;
      }

      const control = parseStreamedGenerationControlEvent(message);

      if (control) {
        onControl?.(control);
      }
    },
  });
}

export async function cancelReplyGenerationRunExecution(runId: string): Promise<{ cancelled: boolean }> {
  const response = await postJson<{ cancelled: boolean }>(`${SERVER_BASE_URL}/replies/${encodeURIComponent(runId)}/cancel`, {});
  return response;
}
