import { useEffect, useState } from 'react';

import { DEFAULT_PANEL_VIEW, DEFAULT_TONE } from '../../core/constants';
import type { DomainHistoryItem } from '../../core/messages';
import type { PanelView, Tone } from '../../core/types';
import type { PanelAction, PanelCallbacks, PanelController } from '../../ui/mount-panel';
import type { PanelViewState } from './panel-types';
import {
  appendSentenceBufferChunk,
  createSentenceBufferState,
  flushSentenceBuffer,
  sentenceBufferText,
} from './sentence-buffer';

export function usePanelViewState(callbacks: PanelCallbacks, controller: PanelController) {
  const [view, setView] = useState<PanelViewState>({
    activeView: callbacks.initialView ?? DEFAULT_PANEL_VIEW,
    selectedText: '',
    tone: callbacks.initialTone ?? DEFAULT_TONE,
    state: 'empty',
    connectionStatus: 'disconnected',
    insertionTarget: { status: 'needs_recapture', message: 'Open Draftlet from a compose field to enable insertion.' },
    restoreState: null,
    threadSnapshot: null,
    history: [],
    historyState: 'idle',
    errorMessage: '',
    persistenceMessage: '',
    streamingDraft: null,
  });

  useEffect(() => controller.subscribe((action) => {
    setView((current) => reducePanelAction(current, action));
  }), [controller]);

  const loadHistory = async () => {
    if (!callbacks.onLoadHistory) {
      setView((current) => ({ ...current, historyState: 'error', persistenceMessage: 'History is unavailable here.' }));
      return;
    }

    setView((current) => ({ ...current, historyState: 'loading', persistenceMessage: '' }));

    try {
      const history = await callbacks.onLoadHistory();
      setView((current) => ({ ...current, history, historyState: 'success' }));
    } catch {
      setView((current) => ({
        ...current,
        historyState: 'error',
        persistenceMessage: 'Could not load history.',
      }));
    }
  };

  useEffect(() => {
    if (view.activeView === 'history' && view.historyState === 'idle') {
      void loadHistory();
    }
  }, [view.activeView, view.historyState]);

  const restoreHistoryItem = async (item: DomainHistoryItem) => {
    if (!callbacks.onRestoreHistoryItem) {
      setView((current) => ({ ...current, persistenceMessage: 'History restore is unavailable here.' }));
      return;
    }

    setView((current) => ({ ...current, persistenceMessage: 'Restoring thread...' }));
    const result = await callbacks.onRestoreHistoryItem(item);
    setView((current) => ({
      ...current,
      activeView: result.ok ? 'replies' : current.activeView,
      persistenceMessage: result.message,
    }));
  };

  const selectTone = (tone: Tone) => {
    setView((current) => ({ ...current, tone }));
    callbacks.onToneChange?.(tone);
  };

  const selectView = (activeView: PanelView) => {
    setView((current) => ({ ...current, activeView, persistenceMessage: '' }));
    callbacks.onViewChange?.(activeView);
  };

  const retryInterruptedTurn = async (turnId: string) => {
    if (!callbacks.onRetryInterruptedTurn) {
      setView((current) => ({ ...current, persistenceMessage: 'Retry is unavailable here.' }));
      return;
    }

    setView((current) => ({ ...current, persistenceMessage: 'Starting a new run from this thread...' }));
    const result = await callbacks.onRetryInterruptedTurn(turnId);
    setView((current) => ({ ...current, persistenceMessage: result.message }));
  };

  return {
    loadHistory,
    restoreHistoryItem,
    retryInterruptedTurn,
    selectTone,
    selectView,
    view,
  };
}

function reducePanelAction(current: PanelViewState, action: PanelAction): PanelViewState {
  if (action.type === 'open') {
    return {
      ...current,
      activeView: action.options.activeView ?? current.activeView,
      selectedText: action.options.selectedText,
      tone: action.options.tone ?? current.tone,
      state: 'empty',
      restoreState: null,
      threadSnapshot: null,
      errorMessage: '',
      persistenceMessage: '',
      streamingDraft: null,
    };
  }

  if (action.type === 'setTone') {
    return { ...current, tone: action.tone };
  }

  if (action.type === 'setActiveView') {
    return { ...current, activeView: action.activeView, persistenceMessage: '' };
  }

  if (action.type === 'setConnectionStatus') {
    return { ...current, connectionStatus: action.status };
  }

  if (action.type === 'setInsertionTargetStatus') {
    return { ...current, insertionTarget: action.target };
  }

  if (action.type === 'setRestoreState') {
    return { ...current, restoreState: action.restoreState };
  }

  if (action.type === 'setState') {
    return {
      ...current,
      state: action.state,
      errorMessage: action.message,
      streamingDraft: action.state === 'loading' || action.state === 'streaming'
        ? current.streamingDraft
        : finalizeStreamingDraft(current.streamingDraft),
    };
  }

  if (action.type === 'setThreadSnapshot') {
    return {
      ...current,
      threadSnapshot: action.snapshot,
      persistenceMessage: '',
      streamingDraft: shouldClearStreamingDraft(current.streamingDraft, action.snapshot)
        ? null
        : current.streamingDraft,
    };
  }

  if (action.type === 'appendDraftTextDelta') {
    return {
      ...current,
      streamingDraft: appendDraftTextDelta(current.streamingDraft, action.delta),
    };
  }

  return current;
}

function appendDraftTextDelta(
  current: PanelViewState['streamingDraft'],
  delta: Extract<PanelAction, { type: 'appendDraftTextDelta' }>['delta'],
): PanelViewState['streamingDraft'] {
  const now = Date.now();
  const isSameDraft = current
    && current.sessionId === delta.sessionId
    && current.generationId === delta.generationId
    && current.threadId === delta.threadId
    && current.turnId === delta.turnId
    && !current.isFinal;
  let next = isSameDraft
    ? current
    : {
        sessionId: delta.sessionId,
        generationId: delta.generationId,
        threadId: delta.threadId,
        turnId: delta.turnId,
        buffer: createSentenceBufferState(),
        isFinal: false,
        startedAt: now,
        updatedAt: now,
      };
  const parts = delta.text.split('---');

  for (let index = 0; index < parts.length; index += 1) {
    if (index > 0 && sentenceBufferText(next.buffer)) {
      next = {
        ...next,
        buffer: createSentenceBufferState(),
        startedAt: now,
      };
    }

    const text = cleanStreamDelta(parts[index], sentenceBufferText(next.buffer).length === 0);

    if (text) {
      next = {
        ...next,
        buffer: appendSentenceBufferChunk(next.buffer, text),
        updatedAt: now,
      };
    }
  }

  return next;
}

function finalizeStreamingDraft(draft: PanelViewState['streamingDraft']): PanelViewState['streamingDraft'] {
  if (!draft) {
    return null;
  }

  const buffer = flushSentenceBuffer(draft.buffer);

  if (!sentenceBufferText(buffer)) {
    return null;
  }

  return {
    ...draft,
    buffer,
    isFinal: true,
    updatedAt: Date.now(),
  };
}

function shouldClearStreamingDraft(
  draft: PanelViewState['streamingDraft'],
  snapshot: PanelViewState['threadSnapshot'],
): boolean {
  if (!draft || draft.isFinal || !snapshot) {
    return false;
  }

  return snapshot.variants.some((variant) => variant.turnId === draft.turnId);
}

function cleanStreamDelta(text: string, atStart: boolean): string {
  let next = text;

  if (atStart) {
    next = next.replace(/^\s*(?:sure[,.]?\s*)?here\s+(?:are|is)\s+(?:three|3)\s+(?:draft\s+)?repl(?:y|ies)\s*:?\s*/i, '');
    next = next.replace(/^\s*(?:\d+[).]|[-*])\s+/, '');
  }

  return next;
}
