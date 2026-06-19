import type { SendMessage } from '../runtime-message-bus';

let sendMessage: SendMessage = () => Promise.reject(new Error('sendMessage not initialized'));

export function configureSendMessage(fn: SendMessage): void {
  sendMessage = fn;
}

export function getSendMessage(): SendMessage {
  return sendMessage;
}
