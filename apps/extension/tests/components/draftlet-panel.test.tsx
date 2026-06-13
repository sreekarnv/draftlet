import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { mountDraftletPanel } from '../../ui/mount-panel';
import type { ConversationThreadSnapshot, Turn } from '../../core/messages';
import type { InsertionResult } from '../../core/types';

describe('DraftletPanel recapture guidance', () => {
  let mounted: ReturnType<typeof mountDraftletPanel> | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = '';
  });

  it('guides the user to focus the selected tab compose field and retry recapture', async () => {
    const container = document.createElement('div');
    let activatedTabId: number | null = null;
    document.body.append(container);

    await act(async () => {
      mounted = mountDraftletPanel(container, {
        onGenerate() {},
        onInsert: async (): Promise<InsertionResult> => ({ status: 'copied', message: 'Copied' }),
        onActivateRecaptureTab: async (tabId) => {
          activatedTabId = tabId;
          return { ok: true, message: 'Selected tab opened. Focus the compose field there, then retry recapture.' };
        },
        onCloseRequest() {},
        onAfterRender() {},
      });
    });

    await act(async () => {
      mounted!.controller.open({
        selectedText: 'Can you reply to this thread?',
      });
      mounted!.controller.setInsertionTargetStatus({
        status: 'needs_focus',
        outcome: 'needs_focused_compose_target',
        message: 'Tab selected. Focus the compose field in that tab, then retry recapture.',
        trail: [
          {
            event: 'recapture_requested',
            level: 'pending',
            message: 'Retrying recapture in the selected tab.',
            tabId: 42,
            at: '2026-01-01T00:00:00.000Z',
          },
          {
            event: 'focus_required',
            level: 'warning',
            message: 'Tab selected. Focus the compose field in that tab, then retry recapture.',
            tabId: 42,
            at: '2026-01-01T00:00:01.000Z',
          },
        ],
        selectedTab: {
          tabId: 42,
          windowId: 1,
          title: 'Thread',
          url: 'https://example.com/thread',
          origin: 'https://example.com',
          active: false,
          currentWindow: true,
          matchReason: 'target_url',
        },
      });
    });

    expect(container.textContent).toContain('Focus compose field');
    expect(container.textContent).toContain('Selected: Thread');
    expect(container.textContent).toContain('Tab selected. Focus the compose field in that tab, then retry recapture.');
    expect(container.textContent).toContain('Retrying recapture in the selected tab.');
    expect(container.textContent).toContain('Open tab');
    expect(container.textContent).toContain('Retry recapture');

    const openTabButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Open tab'));

    await act(async () => {
      openTabButton?.click();
    });

    expect(activatedTabId).toBe(42);
    expect(container.textContent).toContain('Selected tab opened. Focus the compose field there, then retry recapture.');
  });

  it('shows interrupted generation recovery and retries from the existing thread', async () => {
    const container = document.createElement('div');
    let retriedTurnId: string | null = null;
    document.body.append(container);

    await act(async () => {
      mounted = mountDraftletPanel(container, {
        onGenerate() {},
        onRetryInterruptedTurn: async (turnId) => {
          retriedTurnId = turnId;
          return { ok: true, message: 'Started a new run from this thread.' };
        },
        onInsert: async (): Promise<InsertionResult> => ({ status: 'copied', message: 'Copied' }),
        onCloseRequest() {},
        onAfterRender() {},
      });
    });

    await act(async () => {
      mounted!.controller.open({
        selectedText: 'Can you reply to this thread?',
      });
      mounted!.controller.setThreadSnapshot(interruptedThreadSnapshot());
      mounted!.controller.setState('error', 'Draft generation was interrupted before completion.');
    });

    expect(container.textContent).toContain('Interrupted after restart');
    expect(container.textContent).toContain('Retry starts a new run from this thread');
    expect(container.textContent).toContain('will not resume the old stream');
    expect(container.textContent).toContain('Retry from thread');

    const retryButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Retry from thread'));

    await act(async () => {
      retryButton?.click();
    });

    expect(retriedTurnId).toBe('turn-2');
    expect(container.textContent).toContain('Started a new run from this thread.');
  });
});

function interruptedThreadSnapshot(): ConversationThreadSnapshot {
  return {
    thread: {
      threadId: 'thread-1',
      sessionId: 'session-1',
      source: {
        selectedText: 'Can you reply to this thread?',
        sourceUrl: 'https://example.com/thread',
        sourceDomain: 'example.com',
        pageTitle: 'Example',
      },
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:02:00.000Z',
      latestTurnId: 'turn-2',
    },
    turns: [
      turn('turn-1', 'Generate reply drafts', 'completed', '2026-01-01T00:01:00.000Z'),
      turn('turn-2', 'Generate reply drafts', 'failed', '2026-01-01T00:02:00.000Z', {
        code: 'generation_interrupted',
        message: 'Draft generation was interrupted before completion.',
      }),
    ],
    variants: [
      {
        variantId: 'variant-1',
        turnId: 'turn-1',
        tone: 'friendly',
        content: 'Prior completed draft.',
        rank: 0,
        status: 'generated',
        isCurrent: true,
        createdAt: '2026-01-01T00:01:10.000Z',
        updatedAt: '2026-01-01T00:01:10.000Z',
      },
    ],
  };
}

function turn(
  turnId: string,
  instruction: string,
  generationStatus: Turn['generationStatus'],
  createdAt: string,
  error?: { code: string; message: string },
): Turn {
  return {
    turnId,
    threadId: 'thread-1',
    instruction,
    source: {
      selectedText: 'Can you reply to this thread?',
      sourceUrl: 'https://example.com/thread',
      sourceDomain: 'example.com',
      pageTitle: 'Example',
    },
    tone: 'friendly',
    generationStatus,
    generationErrorCode: error?.code,
    generationErrorMessage: error?.message,
    createdAt,
    updatedAt: createdAt,
  };
}
