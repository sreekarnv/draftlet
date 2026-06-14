import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { mountDraftletPanel } from '../../ui/mount-panel';
import type { ConversationThreadSnapshot, Turn, WorkspaceRestoreState } from '../../core/messages';
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

    expect(container.textContent).toContain('Interrupted runtime run');
    expect(container.textContent).toContain('Run generation-2');
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

  it('shows restore conflict guidance and uses the projected primary recapture action', async () => {
    const container = document.createElement('div');
    let recaptured = false;
    document.body.append(container);

    await act(async () => {
      mounted = mountDraftletPanel(container, {
        onGenerate() {},
        onRecaptureInsertionTarget: async () => {
          recaptured = true;
          return { ok: false, message: 'Focus a compose field and recapture.' };
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
      mounted!.controller.setRestoreState(staleTargetRestoreState());
    });

    expect(container.textContent).toContain('Restored thread is ready, but insertion needs target recovery.');
    expect(container.textContent).toContain('The saved compose target is stale after restore.');
    expect(container.textContent).toContain('Recapture');

    const recaptureButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Recapture'));

    await act(async () => {
      recaptureButton?.click();
    });

    expect(recaptured).toBe(true);
    expect(container.textContent).toContain('Focus a compose field and recapture.');
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
      turn('turn-2', 'Generate reply drafts', 'failed', '2026-01-01T00:02:00.000Z'),
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
    latestRecoverableRun: {
      runId: 'generation-2',
      turnId: 'turn-2',
      status: 'interrupted',
      recoverable: true,
      reason: 'generation_interrupted',
      interruptedAt: '2026-01-01T00:02:30.000Z',
      lastEventAt: '2026-01-01T00:02:31.000Z',
      errorCode: 'generation_interrupted',
      errorMessage: 'Draft generation was interrupted before completion.',
    },
  };
}

function completedThreadSnapshot(): ConversationThreadSnapshot {
  const base = interruptedThreadSnapshot();

  return {
    ...base,
    thread: {
      ...base.thread,
      latestTurnId: 'turn-1',
      status: 'active',
      updatedAt: '2026-01-01T00:01:00.000Z',
    },
    turns: [
      turn('turn-1', 'Generate reply drafts', 'completed', '2026-01-01T00:01:00.000Z'),
    ],
    latestRecoverableRun: undefined,
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
        action: {
          kind: 'recapture_target',
          label: 'Recapture',
          message: 'Recapture the compose field before inserting.',
        },
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
