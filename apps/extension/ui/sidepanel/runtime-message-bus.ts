import type { DraftletMessage } from '../../core/messages';

export type SendMessage = <T = unknown>(message: DraftletMessage) => Promise<T>;

export function sendRuntimeMessage<T = unknown>(message: DraftletMessage): Promise<T> {
  return browser.runtime.sendMessage(message) as Promise<T>;
}
