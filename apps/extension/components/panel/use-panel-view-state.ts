import { useEffect, useState } from 'react';

import { DEFAULT_PANEL_VIEW, DEFAULT_TONE } from '../../core/constants';
import type { DomainHistoryItem } from '../../core/messages';
import type { PanelView, Tone } from '../../core/types';
import type { PanelAction, PanelCallbacks, PanelController } from '../../ui/mount-panel';
import type { PanelViewState } from './panel-types';

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

  const recaptureInsertionTarget = async (_tabId?: number) => {
    // The visible Recapture flow has been removed. Insert/Use owns the
    // full target recovery path. This stub remains only so the function
    // shape on the hook return value stays stable for any external callers.
    setView((current) => ({ ...current, persistenceMessage: '' }));
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

  const activateRecaptureTab = async (_tabId: number) => {
    // The visible Recapture flow has been removed. This stub remains only
    // so the function shape on the hook return value stays stable.
    setView((current) => ({ ...current, persistenceMessage: '' }));
  };

  return {
    activateRecaptureTab,
    loadHistory,
    recaptureInsertionTarget,
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
    return { ...current, state: action.state, errorMessage: action.message };
  }

  if (action.type === 'setThreadSnapshot') {
    return { ...current, threadSnapshot: action.snapshot, persistenceMessage: '' };
  }

  return current;
}
