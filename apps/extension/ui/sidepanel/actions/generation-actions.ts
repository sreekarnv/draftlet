import {
  CANCEL_DRAFT_GENERATION,
  START_DRAFT_GENERATION,
  START_DRAFT_REFINEMENT,
  type DraftletMessage,
  type StartDraftGenerationResult,
} from '../../../core/messages';
import type { PanelController } from '../../mount-panel';
import type { SidePanelState } from '../state';
import type { ActionResult, VariantActionResult } from './action-types';
import { getSendMessage } from './message-client';

export async function startDraftGenerationFromCurrentSession(
  state: SidePanelState,
  panel: PanelController,
  options: { missingContextMessage?: string; startErrorMessage?: string; successMessage?: string } = {},
): Promise<ActionResult> {
  if (!state.runtime.currentSession?.latestContext.selectedText) {
    const message = options.missingContextMessage ?? 'Select text on a page before generating replies.';
    panel.setState('error', message);
    return { ok: false, message };
  }

  await cancelActiveGeneration(state);

  panel.setState('loading');

  try {
    const response = await getSendMessage()<StartDraftGenerationResult>({
      type: START_DRAFT_GENERATION,
      sessionId: state.runtime.currentSession.sessionId,
      tone: state.ui.currentTone,
      activeView: state.ui.currentPanelView,
    } satisfies DraftletMessage);

    if (!response.started || !response.generationId || !response.sessionId) {
      const message = response.error?.message ?? options.startErrorMessage ?? 'Could not start draft generation.';
      panel.setState('error', message);
      return { ok: false, message };
    }

    if (state.runtime.currentSession) {
      state.runtime.currentSession = {
        ...state.runtime.currentSession,
        activeThreadId: response.threadId ?? state.runtime.currentSession.activeThreadId,
        activeTurnId: response.turnId ?? state.runtime.currentSession.activeTurnId,
        activeRunId: response.generationId,
      };
    }
    return { ok: true, message: options.successMessage ?? 'Started draft generation.' };
  } catch (error) {
    panel.setConnectionStatus('disconnected');
    const message = error instanceof Error ? error.message : 'Could not reach the Draftlet extension coordinator.';
    panel.setState('error', message);
    return { ok: false, message };
  }
}

export async function generateReplies(state: SidePanelState, panel: PanelController): Promise<void> {
  const result = await startDraftGenerationFromCurrentSession(state, panel);

  if (!result.ok && result.message) {
    panel.setState('error', result.message);
  }
}

export async function retryInterruptedTurn(state: SidePanelState, panel: PanelController, _turnId: string): Promise<VariantActionResult> {
  const result = await startDraftGenerationFromCurrentSession(state, panel, {
    missingContextMessage: 'Restore the thread context before retrying this draft.',
    startErrorMessage: 'Could not retry this draft generation.',
    successMessage: 'Started a new run from this thread.',
  });
  return { ok: result.ok, message: result.message ?? '' };
}

export async function refineReplies(state: SidePanelState, panel: PanelController, instruction: string): Promise<void> {
  if (!state.runtime.currentSession?.latestContext.selectedText) {
    panel.setState('error', 'Select text on a page before refining replies.');
    return;
  }

  const trimmedInstruction = instruction.trim();

  if (!trimmedInstruction) {
    panel.setState('error', 'Add a follow-up instruction before refining drafts.');
    return;
  }

  await cancelActiveGeneration(state);

  panel.setState('loading');

  try {
    const response = await getSendMessage()<StartDraftGenerationResult>({
      type: START_DRAFT_REFINEMENT,
      sessionId: state.runtime.currentSession.sessionId,
      instruction: trimmedInstruction,
      tone: state.ui.currentTone,
      activeView: state.ui.currentPanelView,
    } satisfies DraftletMessage);

    if (!response.started || !response.generationId || !response.sessionId) {
      panel.setState('error', response.error?.message ?? 'Could not start draft refinement.');
      return;
    }

    if (state.runtime.currentSession) {
      state.runtime.currentSession = {
        ...state.runtime.currentSession,
        activeThreadId: response.threadId ?? state.runtime.currentSession.activeThreadId,
        activeTurnId: response.turnId ?? state.runtime.currentSession.activeTurnId,
        activeRunId: response.generationId,
      };
    }
  } catch (error) {
    panel.setConnectionStatus('disconnected');
    panel.setState(
      'error',
      error instanceof Error ? error.message : 'Could not reach the Draftlet extension coordinator.',
    );
  }
}

export async function cancelActiveGeneration(state: SidePanelState): Promise<void> {
  const session = state.runtime.currentSession;
  const generationId = session?.activeRunId;

  if (!session || !generationId) {
    return;
  }

  state.runtime.currentSession = {
    ...session,
    activeRunId: undefined,
  };

  await getSendMessage()({
    type: CANCEL_DRAFT_GENERATION,
    sessionId: session.sessionId,
    generationId,
  } satisfies DraftletMessage).catch(() => {});
}

export async function closeSidePanel(state: SidePanelState): Promise<void> {
  await cancelActiveGeneration(state);

  try {
    if (browser.sidePanel?.close) {
      const currentWindow = await browser.windows.getCurrent();

      if (currentWindow.id !== undefined) {
        await browser.sidePanel.close({ windowId: currentWindow.id });
        return;
      }
    }
  } catch {
    // Older Chrome versions may not expose sidePanel.close.
  }

  window.close();
}
