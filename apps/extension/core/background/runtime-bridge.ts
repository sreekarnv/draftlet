import { registerMessageRouter } from './message-router';

export function mountBackground(): void {
  registerMessageRouter(browser.runtime.onMessage);
}
