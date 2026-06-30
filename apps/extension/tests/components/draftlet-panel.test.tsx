import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mountDraftletPanel } from '../../ui/mount-panel';
import type { ConversationThreadSnapshot, Turn, WorkspaceRestoreState } from '../../core/messages';
import type { InsertionResult } from '../../core/types';

describe('DraftletPanel insertion target recovery', () => {
  let mounted: ReturnType<typeof mountDraftletPanel> | null = null;

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    document.body.innerHTML = '';
  });

  it('renders a status pill only (no Recapture button) when the target needs focus', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    await act(async () => {
      mounted = mountDraftletPanel(container, {
        onGenerate() {},
        onInsert: async (): Promise<InsertionResult> => ({ status: 'inserted', message: 'Inserted.' }),
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
        message: 'Click the compose field to insert.',
        trail: [],
      });
    });

    expect(container.textContent).toContain('Click the compose field to insert.');

    // The visible Recapture button must be gone.
    const recaptureButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Recapture'));
    expect(recaptureButton).toBeUndefined();
  });

  it('shows the in-progress "Click the compose field to insert." copy and no Recapture button', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    await act(async () => {
      mounted = mountDraftletPanel(container, {
        onGenerate() {},
        onInsert: async (): Promise<InsertionResult> => ({ status: 'inserted', message: 'Inserted.' }),
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
        message: 'Click the compose field to insert.',
        trail: [],
      });
    });

    expect(container.textContent).not.toContain('Open the page with the compose field, focus it, and try again.');
    expect(container.textContent).not.toContain('Recapture');
  });

  it('shows the copied-fallback guidance when the insert path falls back to clipboard', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    await act(async () => {
      mounted = mountDraftletPanel(container, {
        onGenerate() {},
        onInsert: async (): Promise<InsertionResult> => ({ status: 'copied', message: 'Draftlet could not find a compose field, so it copied the draft.' }),
        onCloseRequest() {},
        onAfterRender() {},
      });
    });

    await act(async () => {
      mounted!.controller.open({
        selectedText: 'Can you reply to this thread?',
      });
      mounted!.controller.setInsertionTargetStatus({
        status: 'unavailable',
        message: 'Draftlet could not find a compose field, so it copied the draft.',
        trail: [
          {
            event: 'recapture_failed',
            level: 'failed',
            message: 'Draftlet could not find a compose field, so it copied the draft.',
            at: '2026-01-01T00:00:00.000Z',
          },
        ],
      });
    });

    expect(container.textContent).toContain('Draftlet could not find a compose field, so it copied the draft.');
    expect(container.textContent).not.toContain('Open the page with the compose field');
  });

  it('shows the recapture_target primary action as a passive label, not a button', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    await act(async () => {
      mounted = mountDraftletPanel(container, {
        onGenerate() {},
        onInsert: async (): Promise<InsertionResult> => ({ status: 'inserted', message: 'Inserted.' }),
        onCloseRequest() {},
        onAfterRender() {},
      });
    });

    await act(async () => {
      mounted!.controller.open({
        selectedText: 'Can you reply to this thread?',
      });
      mounted!.controller.setRestoreState(staleTargetRestoreState());
    });

    expect(container.textContent).toContain('Restored thread is ready, but insertion needs target recovery.');
    expect(container.textContent).toContain('The saved compose target is stale after restore.');
    // The recapture_target primary action is now a passive label, not a button.
    const recaptureButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Recapture');
    expect(recaptureButton).toBeUndefined();
  });

  it('submits follow-up refinement instructions through the refinement form', async () => {
    const container = document.createElement('div');
    let refinementInstruction = '';
    document.body.append(container);

    await act(async () => {
      mounted = mountDraftletPanel(container, {
        onGenerate() {},
        onRefine(instruction) {
          refinementInstruction = instruction;
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
      mounted!.controller.setThreadSnapshot(completedThreadSnapshot());
      mounted!.controller.setState('success', '');
    });

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement | null;
    const refineButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Refine')) as HTMLButtonElement | undefined;

    expect(textarea).not.toBeNull();
    expect(refineButton?.disabled).toBe(true);

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      valueSetter?.call(textarea, 'Make this warmer');
      textarea!.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'Make this warmer' }));
    });

    expect(refineButton?.disabled).toBe(false);

    await act(async () => {
      refineButton?.click();
    });

    expect(refinementInstruction).toBe('Make this warmer');
  });

  it('cancels generation on Escape', async () => {
    const container = document.createElement('div');
    const cancelGeneration = vi.fn();
    document.body.append(container);

    await act(async () => {
      mounted = mountDraftletPanel(container, {
        onGenerate() {},
        onCancelGeneration: cancelGeneration,
        onInsert: async (): Promise<InsertionResult> => ({ status: 'copied', message: 'Copied' }),
        onCloseRequest() {},
        onAfterRender() {},
      });
    });

    await act(async () => {
      mounted!.controller.open({ selectedText: 'Can you reply to this thread?' });
      mounted!.controller.setState('streaming', '');
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(cancelGeneration).toHaveBeenCalledTimes(1);
  });

  it('preserves buffered partial draft text after cancellation', async () => {
    const container = document.createElement('div');
    document.body.append(container);

    await act(async () => {
      mounted = mountDraftletPanel(container, {
        onGenerate() {},
        onInsert: async (): Promise<InsertionResult> => ({ status: 'copied', message: 'Copied' }),
        onCloseRequest() {},
        onAfterRender() {},
      });
    });

    await act(async () => {
      mounted!.controller.open({ selectedText: 'Can you reply to this thread?' });
      mounted!.controller.setThreadSnapshot(streamingThreadSnapshot());
      mounted!.controller.setState('streaming', '');
      mounted!.controller.appendDraftTextDelta({
        sessionId: 'session-1',
        generationId: 'generation-1',
        threadId: 'thread-1',
        turnId: 'turn-1',
        text: 'Thanks for reaching out. I can take a closer look',
      });
      mounted!.controller.setState('error', 'Draft generation was cancelled.');
    });

    const textarea = container.querySelector('textarea[aria-label="Preserved partial draft text"]') as HTMLTextAreaElement | null;

    expect(textarea?.value).toBe('Thanks for reaching out. I can take a closer look');
  });
});

function completedThreadSnapshot(): ConversationThreadSnapshot {
  const turn: Turn = {
    turnId: 'turn-1',
    threadId: 'thread-1',
    instruction: 'Generate reply drafts',
    source: {
      selectedText: 'Can you reply to this thread?',
      sourceUrl: 'https://example.com/thread',
      sourceDomain: 'example.com',
      pageTitle: 'Thread',
    },
    tone: 'professional',
    generationStatus: 'completed',
    generationStartedAt: '2026-01-01T00:00:00.000Z',
    generationCompletedAt: '2026-01-01T00:00:01.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:01.000Z',
  };
  return {
    thread: {
      threadId: 'thread-1',
      sessionId: 'session-1',
      source: {
        selectedText: 'Can you reply to this thread?',
        sourceUrl: 'https://example.com/thread',
        sourceDomain: 'example.com',
        pageTitle: 'Thread',
      },
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
      latestTurnId: 'turn-1',
    },
    turns: [turn],
    variants: [
      {
        variantId: 'variant-1',
        turnId: 'turn-1',
        tone: 'professional',
        content: 'Sure, happy to help.',
        rank: 1,
        status: 'generated',
        isCurrent: true,
        createdAt: '2026-01-01T00:00:01.000Z',
        updatedAt: '2026-01-01T00:00:01.000Z',
      },
    ],
  };
}

function streamingThreadSnapshot(): ConversationThreadSnapshot {
  const turn: Turn = {
    turnId: 'turn-1',
    threadId: 'thread-1',
    instruction: 'Generate reply drafts',
    source: {
      selectedText: 'Can you reply to this thread?',
      sourceUrl: 'https://example.com/thread',
      sourceDomain: 'example.com',
      pageTitle: 'Thread',
    },
    tone: 'professional',
    generationStatus: 'streaming',
    generationStartedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  return {
    thread: {
      threadId: 'thread-1',
      sessionId: 'session-1',
      source: turn.source,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      latestTurnId: 'turn-1',
    },
    turns: [turn],
    variants: [],
  };
}

function staleTargetRestoreState(): WorkspaceRestoreState {
  return {
    source: 'history',
    status: 'needs_action',
    summary: 'Restored thread is ready, but insertion needs target recovery.',
    restoredSession: true,
    restoredThread: true,
    activeThreadId: 'thread-1',
    activeTurnId: 'turn-2',
    primaryAction: {
      kind: 'recapture_target',
      label: 'Recapture',
      message: 'Recapture the compose field before inserting.',
    },
    issues: [
      {
        code: 'restored_session',
        severity: 'info',
        message: 'Restored a saved Draftlet session from history.',
      },
      {
        code: 'restored_thread',
        severity: 'info',
        message: 'Restored the saved conversation thread.',
        threadId: 'thread-1',
      },
      {
        code: 'target_stale',
        severity: 'warning',
        message: 'The saved compose target is stale after restore.',
        threadId: 'thread-1',
      },
    ],
  };
}
