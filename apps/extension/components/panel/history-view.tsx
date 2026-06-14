import { FileText } from 'lucide-react';

import type { DomainHistoryItem } from '../../core/messages';
import { EmptyState } from './empty-state';
import { formatDate, summarizeHistoryItem } from './panel-display';
import type { PanelViewState } from './panel-types';
import { SourceContext } from './source-context';
import { StatePill } from './state-pill';
import { Button, Card } from './ui';

interface HistoryViewProps {
  view: PanelViewState;
  onLoadHistory: () => Promise<void>;
  onRestoreHistoryItem: (item: DomainHistoryItem) => Promise<void>;
}

export function HistoryView({ onLoadHistory, onRestoreHistoryItem, view }: HistoryViewProps) {
  if (view.historyState === 'loading') {
    return <EmptyState title="Loading history..." />;
  }

  if (view.historyState === 'error') {
    return (
      <EmptyState title="Could not load history.">
        <Button className="justify-self-start" onClick={() => void onLoadHistory()} type="button" variant="secondary">Retry</Button>
      </EmptyState>
    );
  }

  if (view.history.length === 0) {
    return <EmptyState title="No saved threads yet." />;
  }

  return (
    <div className="grid gap-3">
      {view.history.map((item) => {
        const summary = summarizeHistoryItem(item);

        return (
          <Card className="grid gap-3 bg-white/85 p-3.5 shadow-sm shadow-slate-200/70 ring-1 ring-slate-200/70" key={item.thread.thread.threadId}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">{summary.title}</div>
                <div className="mt-0.5 text-xs leading-5 text-slate-500">{formatDate(summary.updatedAt)}</div>
              </div>
              <StatePill label={item.thread.thread.status} tone="slate" />
            </div>
            <SourceContext domain={item.thread.thread.source.sourceDomain ?? null} url={item.thread.thread.source.sourceUrl ?? null} />
            <p className="m-0 max-h-14 overflow-hidden pl-2.5 text-[13px] leading-6 text-slate-600 shadow-[-2px_0_0_rgba(100,116,139,0.20)]">{item.thread.thread.source.selectedText}</p>
            <div className="grid gap-1.5 text-xs leading-5 text-slate-500">
              <div>{summary.counts}</div>
              {summary.latestInstruction ? <div className="text-slate-600">{summary.latestInstruction}</div> : null}
              {summary.latestDraft ? <p className="m-0 max-h-12 overflow-hidden text-[13px] leading-6 text-slate-700">{summary.latestDraft}</p> : null}
            </div>
            <Button className="justify-self-start" onClick={() => void onRestoreHistoryItem(item)} type="button" variant="secondary">
              <FileText aria-hidden="true" className="h-3.5 w-3.5" />
              Open
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
