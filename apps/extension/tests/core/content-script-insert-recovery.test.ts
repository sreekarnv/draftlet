import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACTIVATE_INSERTION_TAB, INSERTION_IN_PROGRESS, type DraftletMessage } from '../../core/messages';
import { createInsertionTargetStore } from '../../core/insertion-target-store';
import { insertReply } from '../../core/insertion';
import type { FocusSnapshot } from '../../core/focus';

// Mirrors the production chain: try cached, then arm, then send
// INSERTION_IN_PROGRESS, then send ACTIVATE_INSERTION_TAB, then await the
// arm. The chain must be exercised in this exact order. The arm listener
// is installed synchronously before any outbound message is sent.
class TestContentScriptChain {
  readonly targetStore = createInsertionTargetStore();
  readonly sentMessages: DraftletMessage[] = [];
  private activeArmController: AbortController | null = null;
  private supersedeListeners = new Set<() => void>();

  async handleInsertReply(sessionId: string, replyText: string): Promise<{ status: string; errorCode?: string }> {
    if (this.activeArmController) {
      this.activeArmController.abort();
      this.activeArmController = null;
      this.targetStore.cancelArm();
    }

    const live = this.targetStore.getLiveSnapshot();
    if (live) {
      const result = await insertReply(replyText, live);
      return { status: result.status, errorCode: result.errorCode };
    }

    const armController = new AbortController();
    this.activeArmController = armController;
    const armPromise = this.targetStore.armCaptureForNextEditable({ timeoutMs: 50 });

    this.sentMessages.push({
      type: INSERTION_IN_PROGRESS,
      sessionId,
      message: 'Click the compose field to insert.',
    });
    this.sentMessages.push({
      type: ACTIVATE_INSERTION_TAB,
      sessionId,
    });

    let armed: FocusSnapshot | null;
    try {
      armed = await raceWithAbort(armPromise, armController.signal);
    } catch {
      armed = null;
    }

    if (this.activeArmController === armController) {
      this.activeArmController = null;
    }

    if (armController.signal.aborted) {
      return { status: 'failed', errorCode: 'insert_superseded' };
    }

    if (armed) {
      const result = await insertReply(replyText, armed);
      return { status: result.status, errorCode: result.errorCode };
    }

    return { status: 'failed', errorCode: 'armed_capture_timeout' };
  }
}

function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    if (signal.aborted) {
      resolve(null);
      return;
    }
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      resolve(null);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then((value) => {
      if (signal.aborted) return;
      signal.removeEventListener('abort', onAbort);
      resolve(value);
    }).catch(() => {
      if (signal.aborted) return;
      signal.removeEventListener('abort', onAbort);
      resolve(null);
    });
  });
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.stubGlobal('InputEvent', window.InputEvent);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('content-script INSERT_REPLY chain', () => {
  it('inserts into the cached target without arming or sending activation messages', async () => {
    const chain = new TestContentScriptChain();
    const textarea = document.createElement('textarea');
    textarea.value = 'Hello world';
    document.body.append(textarea);
    chain.targetStore.noteFocusIn(textarea);

    const result = await chain.handleInsertReply('session-1', 'Draftlet');

    expect(result.status).toBe('inserted');
    expect(chain.sentMessages).toEqual([]);
  });

  it('installs the arm listener before sending INSERTION_IN_PROGRESS and ACTIVATE_INSERTION_TAB', async () => {
    const chain = new TestContentScriptChain();
    const promise = chain.handleInsertReply('session-1', 'Hello there');

    // The arm listener must be installed synchronously — at this point,
    // no outbound message has been sent yet, but isArmed() should be true.
    expect(chain.targetStore.isArmed()).toBe(true);

    // Wait a microtask for the synchronous sends to land.
    await Promise.resolve();
    const types = chain.sentMessages.map((message) => message.type);
    expect(types).toContain(INSERTION_IN_PROGRESS);
    expect(types).toContain(ACTIVATE_INSERTION_TAB);
    // The pending broadcast was sent BEFORE the activation request.
    expect(types.indexOf(INSERTION_IN_PROGRESS)).toBeLessThan(types.indexOf(ACTIVATE_INSERTION_TAB));

    // Complete the promise (it will time out and report armed_capture_timeout).
    await promise;
  });

  it('inserts immediately when the user focuses an editable during the arm', async () => {
    const chain = new TestContentScriptChain();
    const textarea = document.createElement('textarea');
    textarea.value = 'Hello world';
    document.body.append(textarea);
    textarea.setSelectionRange(0, 0);

    const promise = chain.handleInsertReply('session-1', 'Draftlet reply');

    // Yield a tick so the arm listener is installed before we focus.
    await Promise.resolve();
    textarea.focus();
    textarea.setSelectionRange(0, 0);
    textarea.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    const result = await promise;

    expect(result.status).toBe('inserted');
    expect(result.errorCode).toBeUndefined();
    expect(textarea.value).toBe('Draftlet replyHello world');
  });

  it('reports armed_capture_timeout when the user never focuses an editable', async () => {
    const chain = new TestContentScriptChain();

    const result = await chain.handleInsertReply('session-1', 'Hello there');

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('armed_capture_timeout');
  });

  it('supersedes the prior arm when a second INSERT_REPLY arrives during the first arm', async () => {
    const chain = new TestContentScriptChain();

    const firstPromise = chain.handleInsertReply('session-1', 'First');
    const secondPromise = chain.handleInsertReply('session-1', 'Second');

    const firstResult = await firstPromise;
    const secondResult = await secondPromise;

    expect(firstResult.errorCode).toBe('insert_superseded');
    // The second insert will time out (50 ms) and report armed_capture_timeout.
    expect(secondResult.status).toBe('failed');
    expect(secondResult.errorCode).toBe('armed_capture_timeout');
  });

  it('does not read document.activeElement at any point', async () => {
    const chain = new TestContentScriptChain();

    const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'activeElement');
    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get: () => {
        throw new Error('document.activeElement must not be read by the side-panel insert flow.');
      },
    });

    try {
      const result = await chain.handleInsertReply('session-1', 'Hello there');

      // The chain timed out without reading activeElement.
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('armed_capture_timeout');
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(document, 'activeElement', originalDescriptor);
      } else {
        delete (document as { activeElement?: unknown }).activeElement;
      }
    }
  });
});
