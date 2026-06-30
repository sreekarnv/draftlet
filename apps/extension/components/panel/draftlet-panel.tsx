import { X } from 'lucide-react';
import { useEffect, useLayoutEffect } from 'react';

import type { PanelCallbacks, PanelController } from '../../ui/mount-panel';
import { ComposerWorkspace } from './composer-workspace';
import { HistoryView } from './history-view';
import { RepliesView } from './replies-view';
import { StatusBadge } from './status-badge';
import { usePanelViewState } from './use-panel-view-state';
import { ViewNavigation } from './view-navigation';
import { Button } from './ui';

interface DraftletPanelProps {
  callbacks: PanelCallbacks;
  controller: PanelController;
}

export function DraftletPanel({ callbacks, controller }: DraftletPanelProps) {
  const {
    loadHistory,
    restoreHistoryItem,
    retryInterruptedTurn,
    selectTone,
    selectView,
    view,
  } = usePanelViewState(callbacks, controller);

  useLayoutEffect(() => {
    callbacks.onAfterRender();
  });

  useEffect(() => {
    const isGenerating = view.state === 'loading' || view.state === 'streaming';

    if (!isGenerating || !callbacks.onCancelGeneration) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      callbacks.onCancelGeneration?.();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [callbacks, view.state]);

  return (
    <section
      aria-label="Draftlet"
      className="flex min-h-screen w-full flex-col overflow-hidden border-0 bg-[#f4f1ea] font-sans text-sm leading-6 text-slate-900"
      role="dialog"
    >
      <div className="shrink-0 bg-[linear-gradient(180deg,#ffffff,#f4f7fb)] px-3.5 pb-3 pt-3.5 shadow-sm shadow-slate-200/80">
        <div className="grid grid-cols-[1fr_auto_auto] items-start gap-2">
          <div className="min-w-0">
            <span className="font-serif text-[18px] font-semibold tracking-normal text-slate-950">Draftlet</span>
            <div className="mt-0.5 text-[11px] font-medium uppercase tracking-normal text-slate-500">Local draft workspace</div>
          </div>
          <StatusBadge status={view.connectionStatus} />
          <Button aria-label="Close Draftlet" onClick={callbacks.onCloseRequest} type="button" variant="ghost">
            <X aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
        {view.activeView === 'replies' ? (
          <ComposerWorkspace
            callbacks={callbacks}
            onRetryInterruptedTurn={retryInterruptedTurn}
            onSelectTone={selectTone}
            view={view}
          />
        ) : null}
        <div className="mt-3">
          <ViewNavigation onSelectView={selectView} view={view} />
        </div>
      </div>
      <div className="grid min-h-0 gap-3 overflow-y-auto bg-[linear-gradient(180deg,#fbfaf7,#f1f5f9)] p-3.5">
        {view.activeView === 'replies' ? (
          <RepliesView callbacks={callbacks} onRetryInterruptedTurn={retryInterruptedTurn} view={view} />
        ) : null}
        {view.activeView === 'history' ? (
          <HistoryView
            onLoadHistory={loadHistory}
            onRestoreHistoryItem={restoreHistoryItem}
            view={view}
          />
        ) : null}
        {view.persistenceMessage ? <p className="m-0 text-xs leading-5 text-slate-600" role="status">{view.persistenceMessage}</p> : null}
      </div>
    </section>
  );
}
