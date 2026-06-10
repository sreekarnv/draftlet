import { FileText, History, RefreshCw, Sparkles, Wand2, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';

import { DEFAULT_PANEL_VIEW, DEFAULT_TONE } from '../../core/constants';
import type { ConversationThreadSnapshot, DomainHistoryItem } from '../../core/messages';
import type { ConnectionStatus, PanelState, PanelView, Tone } from '../../core/types';
import type { InsertionTargetViewState, PanelAction, PanelCallbacks, PanelController } from '../../ui/mount-panel';
import { ReplyCard } from './ReplyCard';
import { StatusBadge } from './StatusBadge';
import { ToneTabs } from './ToneTabs';
import { buildThreadWorkspace, type ThreadTurnGroup } from './thread-workspace';
import { Button, Card, cn } from './ui';

interface DraftletPanelProps {
  callbacks: PanelCallbacks;
  controller: PanelController;
}

type LoadState = 'idle' | 'loading' | 'success' | 'error';

interface PanelViewState {
  activeView: PanelView;
  selectedText: string;
  tone: Tone;
  state: PanelState;
  connectionStatus: ConnectionStatus;
  insertionTarget: InsertionTargetViewState;
  threadSnapshot: ConversationThreadSnapshot | null;
  history: DomainHistoryItem[];
  historyState: LoadState;
  errorMessage: string;
  persistenceMessage: string;
}

export function DraftletPanel({ callbacks, controller }: DraftletPanelProps) {
  const [view, setView] = useState<PanelViewState>({
    activeView: callbacks.initialView ?? DEFAULT_PANEL_VIEW,
    selectedText: '',
    tone: callbacks.initialTone ?? DEFAULT_TONE,
    state: 'empty',
    connectionStatus: 'disconnected',
    insertionTarget: { status: 'needs_recapture', message: 'Open Draftlet from a compose field to enable insertion.' },
    threadSnapshot: null,
    history: [],
    historyState: 'idle',
    errorMessage: '',
    persistenceMessage: '',
  });

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

  useEffect(() => controller.subscribe((action) => {
    setView((current) => reducePanelAction(current, action));
  }), [controller]);

  useEffect(() => {
    if (view.activeView === 'history' && view.historyState === 'idle') {
      void loadHistory();
    }
  }, [view.activeView, view.historyState]);

  useLayoutEffect(() => {
    callbacks.onAfterRender();
  });

  const selectTone = (tone: Tone) => {
    setView((current) => ({ ...current, tone }));
    callbacks.onToneChange?.(tone);
  };

  const selectView = (activeView: PanelView) => {
    setView((current) => ({ ...current, activeView, persistenceMessage: '' }));
    callbacks.onViewChange?.(activeView);
  };

  const [refinementInstruction, setRefinementInstruction] = useState('');
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
        {view.activeView === 'replies' ? renderComposerWorkspace(view, callbacks, selectTone, refinementInstruction, setRefinementInstruction) : null}
        <div className="mt-3">
          {renderViewNavigation(view, selectView)}
        </div>
      </div>
      <div className="grid min-h-0 gap-3 overflow-y-auto bg-[linear-gradient(180deg,#fbfaf7,#f1f5f9)] p-3.5">
        {view.activeView === 'replies' ? renderRepliesView(view, callbacks) : null}
        {view.activeView === 'history' ? renderHistoryView(view, loadHistory, restoreHistoryItem) : null}
        {view.persistenceMessage ? <p className="m-0 text-xs leading-5 text-slate-600" role="status">{view.persistenceMessage}</p> : null}
      </div>
    </section>
  );
}

function renderComposerWorkspace(
  view: PanelViewState,
  callbacks: PanelCallbacks,
  selectTone: (tone: Tone) => void,
  refinementInstruction: string,
  setRefinementInstruction: (instruction: string) => void,
) {
  const isGenerating = view.state === 'loading' || view.state === 'streaming';
  const hasDrafts = draftCount(view) > 0;

  return (
    <section className="mt-3 grid gap-3 rounded-lg bg-white/75 p-3 shadow-sm shadow-slate-200/70 ring-1 ring-slate-200/70">
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-normal text-slate-500">
            <FileText aria-hidden="true" className="h-3.5 w-3.5" />
            Context
          </div>
          <div className="grid justify-items-end gap-0.5 text-right">
            <div className={cn('text-xs font-semibold leading-5 text-slate-500', stateToneClass(view.state))}>{getStateText(view)}</div>
            <div className={cn('text-[11px] font-medium leading-4', targetToneClass(view.insertionTarget.status))}>
              {targetStatusLabel(view.insertionTarget)}
            </div>
          </div>
        </div>
        <p className="m-0 max-h-[4.75rem] overflow-hidden text-[13.5px] leading-6 text-slate-800">{view.selectedText}</p>
      </div>
      <div className="grid gap-2">
        <ToneTabs onSelect={selectTone} selectedTone={view.tone} />
        <Button
          className="w-full px-3.5"
          disabled={isGenerating}
          onClick={callbacks.onGenerate}
          type="button"
          variant="primary"
        >
          {hasDrafts ? <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" /> : <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />}
          {hasDrafts ? 'Regenerate' : 'Generate'}
        </Button>
        {hasDrafts && callbacks.onRefine ? (
          <div className="grid gap-2">
            <textarea
              aria-label="Follow-up instruction"
              className="min-h-20 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-[13.5px] leading-6 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
              disabled={isGenerating}
              onChange={(event) => setRefinementInstruction(event.target.value)}
              placeholder="Make this warmer"
              value={refinementInstruction}
            />
            <Button
              className="w-full px-3.5"
              disabled={isGenerating || !refinementInstruction.trim()}
              onClick={() => callbacks.onRefine?.(refinementInstruction)}
              type="button"
              variant="secondary"
            >
              <Wand2 aria-hidden="true" className="h-3.5 w-3.5" />
              Refine
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function renderRepliesView(
  view: PanelViewState,
  callbacks: PanelCallbacks,
) {
  const isGenerating = view.state === 'loading' || view.state === 'streaming';

  if (view.threadSnapshot) {
    return renderThreadWorkspace(view.threadSnapshot, view, callbacks);
  }

  return <EmptyState title={isGenerating ? 'Waiting for streamed replies...' : 'Generated drafts will appear here.'} />;
}

function renderThreadWorkspace(
  snapshot: ConversationThreadSnapshot,
  view: PanelViewState,
  callbacks: PanelCallbacks,
) {
  const model = buildThreadWorkspace(snapshot);
  const source = formatSource(snapshot.thread.source.sourceDomain ?? null, snapshot.thread.source.sourceUrl ?? null);

  if (model.groups.length === 0) {
    return <EmptyState title="Generated drafts will appear here." />;
  }

  return (
    <section className="grid gap-4" aria-label="Thread workspace">
      <div className="grid gap-2 rounded-lg bg-white/80 p-3.5 ring-1 ring-slate-200/80">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">Active thread</div>
            <div className="mt-0.5 text-xs leading-5 text-slate-500">
              {model.groups.length} {model.groups.length === 1 ? 'turn' : 'turns'} · {model.totalVariants} {model.totalVariants === 1 ? 'variant' : 'variants'}
            </div>
          </div>
          <StatePill label={snapshot.thread.status} tone="slate" />
        </div>
        {source ? <SourceContext domain={snapshot.thread.source.sourceDomain ?? null} url={snapshot.thread.source.sourceUrl ?? null} /> : null}
        <p className="m-0 max-h-16 overflow-hidden pl-2.5 text-[13px] leading-6 text-slate-600 shadow-[-2px_0_0_rgba(100,116,139,0.20)]">
          {snapshot.thread.source.selectedText}
        </p>
      </div>
      <div className="grid gap-4">
        {model.groups.map((group, index) => renderTurnGroup(group, index, view, callbacks))}
      </div>
    </section>
  );
}

function renderTurnGroup(
  group: ThreadTurnGroup,
  index: number,
  view: PanelViewState,
  callbacks: PanelCallbacks,
) {
  const isGenerating = view.state === 'loading' || view.state === 'streaming';
  const waitingForVariants = group.isLatest && isGenerating && group.variants.length === 0;

  return (
    <section
      aria-label={`Turn ${index + 1}`}
      className={cn(
        'grid gap-2.5 pl-3',
        group.isLatest ? 'border-l-2 border-slate-500' : 'border-l border-slate-200',
      )}
      key={group.turn.turnId}
    >
      <div className="grid gap-1 rounded-md bg-white/70 px-3 py-2 ring-1 ring-slate-200/70">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">Turn {index + 1}</div>
            <div className="mt-0.5 text-xs leading-5 text-slate-500">
              {group.turn.tone} · {formatDate(group.turn.createdAt)}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {group.isLatest ? <StatePill label="Latest" tone="slate" /> : null}
            <StatePill label={group.turn.generationStatus} tone={group.turn.generationStatus === 'failed' ? 'rose' : 'slate'} />
          </div>
        </div>
        <p className="m-0 text-[13px] leading-6 text-slate-700">{turnInstructionLabel(group.turn.instruction, index)}</p>
      </div>
      {waitingForVariants ? <div className="rounded-md bg-white/65 p-3 text-[13px] leading-6 text-slate-500 ring-1 ring-slate-200/70">Waiting for streamed variants...</div> : null}
      {group.variants.length > 0 ? (
        <div className="grid gap-2.5">
          {group.variants.map((variant, variantIndex) => (
            <ReplyCard
              index={variantIndex}
              key={variant.variantId}
              onAcceptVariant={callbacks.onAcceptVariant}
              onInsert={callbacks.onInsert}
              onSelectVariant={callbacks.onSelectVariant}
              targetStatus={view.insertionTarget.status}
              variant={variant}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function renderViewNavigation(view: PanelViewState, selectView: (activeView: PanelView) => void) {
  return (
    <nav aria-label="Draftlet workspace" className="rounded-lg bg-slate-100/80 p-1 shadow-inner shadow-white" role="tablist">
      <div className="grid grid-cols-2 gap-1">
        <Button active={view.activeView === 'replies'} onClick={() => selectView('replies')} type="button" variant="tab">
          <FileText aria-hidden="true" className="h-3.5 w-3.5" />
          Replies
        </Button>
        <Button active={view.activeView === 'history'} onClick={() => selectView('history')} type="button" variant="tab">
          <History aria-hidden="true" className="h-3.5 w-3.5" />
          History
        </Button>
      </div>
    </nav>
  );
}

function renderHistoryView(
  view: PanelViewState,
  loadHistory: () => Promise<void>,
  restoreHistoryItem: (item: DomainHistoryItem) => Promise<void>,
) {
  if (view.historyState === 'loading') {
    return <EmptyState title="Loading history..." />;
  }

  if (view.historyState === 'error') {
    return (
      <EmptyState title="Could not load history.">
        <Button className="justify-self-start" onClick={() => void loadHistory()} type="button" variant="secondary">Retry</Button>
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
            <Button className="justify-self-start" onClick={() => void restoreHistoryItem(item)} type="button" variant="secondary">
              <FileText aria-hidden="true" className="h-3.5 w-3.5" />
              Open
            </Button>
          </Card>
        );
      })}
    </div>
  );
}

function SourceContext({ domain, url }: { domain: string | null; url: string | null }) {
  const source = formatSource(domain, url);

  if (!source) {
    return null;
  }

  return (
    <div className="min-w-0 truncate text-xs leading-5 text-slate-500" title={source.title}>
      <span className="font-semibold text-slate-700">{source.domain}</span>
      {source.path ? <span className="text-slate-500"> {source.path}</span> : null}
    </div>
  );
}

function EmptyState({ children, title }: { children?: ReactNode; title: string }) {
  return (
    <div className="grid gap-2.5 rounded-lg bg-white/70 p-3.5 text-[13px] leading-6 text-slate-500 ring-1 ring-slate-200/70">
      <p className="m-0">{title}</p>
      {children}
    </div>
  );
}

function StatePill({ label, tone }: { label: string; tone: 'slate' | 'rose' }) {
  return (
    <span className={cn(
      'rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize leading-4 ring-1',
      tone === 'slate' && 'bg-slate-100 text-slate-700 ring-slate-200',
      tone === 'rose' && 'bg-rose-50 text-rose-700 ring-rose-200',
    )}>
      {label}
    </span>
  );
}

function reducePanelAction(current: PanelViewState, action: PanelAction): PanelViewState {
  if (action.type === 'open') {
    return {
      ...current,
      activeView: action.options.activeView ?? current.activeView,
      selectedText: action.options.selectedText,
      tone: action.options.tone ?? current.tone,
      state: 'empty',
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

  if (action.type === 'setState') {
    return { ...current, state: action.state, errorMessage: action.message };
  }

  if (action.type === 'setThreadSnapshot') {
    return { ...current, threadSnapshot: action.snapshot, persistenceMessage: '' };
  }


  return current;
}

function getStateText(view: PanelViewState) {
  if (view.state === 'loading') {
    return 'Requesting replies...';
  }

  if (view.state === 'streaming') {
    return 'Streaming';
  }

  if (view.state === 'success') {
    return draftCount(view) > 0 ? 'Ready' : 'No replies returned.';
  }

  if (view.state === 'error') {
    return view.errorMessage || 'Could not generate replies.';
  }

  return draftCount(view) > 0 ? 'Ready' : 'Choose tone';
}

function stateToneClass(state: PanelState) {
  if (state === 'error') {
    return 'text-rose-600';
  }

  if (state === 'success') {
    return 'text-emerald-700';
  }

  if (state === 'loading' || state === 'streaming') {
    return 'text-slate-700';
  }

  return '';
}

function targetStatusLabel(target: InsertionTargetViewState) {
  if (target.status === 'live') {
    return 'Target available';
  }

  if (target.status === 'stale') {
    return 'Target stale';
  }

  if (target.status === 'unavailable') {
    return 'Target unavailable';
  }

  return 'Needs recapture';
}

function targetToneClass(status: InsertionTargetViewState['status']) {
  if (status === 'live') {
    return 'text-emerald-700';
  }

  if (status === 'stale') {
    return 'text-amber-700';
  }

  return 'text-slate-500';
}

function draftCount(view: PanelViewState) {
  return view.threadSnapshot?.variants.length ?? 0;
}

function latestHistoryActivity(item: DomainHistoryItem) {
  const timestamps = [
    item.session.updatedAt,
    item.thread.thread.updatedAt,
    ...item.thread.turns.map((turn) => turn.updatedAt),
    ...item.thread.variants.map((variant) => variant.updatedAt),
  ].filter(Boolean);

  return timestamps.sort((a, b) => b.localeCompare(a))[0] ?? item.thread.thread.updatedAt;
}

function summarizeHistoryItem(item: DomainHistoryItem) {
  const latestTurn = [...item.thread.turns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).at(0);
  const preferredVariant = item.thread.variants.find((variant) => variant.status === 'accepted')
    ?? item.thread.variants.find((variant) => variant.isCurrent)
    ?? [...item.thread.variants].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).at(0);
  const title = item.thread.thread.source.pageTitle || item.session.pageTitle || item.thread.thread.source.sourceDomain || 'Saved thread';
  const turnCount = item.thread.turns.length;
  const variantCount = item.thread.variants.length;

  return {
    title,
    counts: `${turnCount} ${turnCount === 1 ? 'turn' : 'turns'} · ${variantCount} ${variantCount === 1 ? 'variant' : 'variants'}`,
    latestInstruction: latestTurn ? turnInstructionLabel(latestTurn.instruction, 0) : '',
    latestDraft: preferredVariant?.content ?? '',
    updatedAt: latestHistoryActivity(item),
  };
}

function turnInstructionLabel(instruction: string, index: number) {
  if (index === 0 && instruction === 'Generate reply drafts') {
    return 'Initial draft generation';
  }

  return instruction;
}

function formatSource(domain: string | null, url: string | null): { domain: string; path: string; title: string } | null {
  if (url) {
    try {
      const parsed = new URL(url);
      const sourceDomain = domain || parsed.hostname;
      const path = parsed.pathname && parsed.pathname !== '/' ? truncate(parsed.pathname, 36) : '';

      return {
        domain: sourceDomain || 'local page',
        path,
        title: url,
      };
    } catch {
      return {
        domain: domain || 'source',
        path: truncate(url, 44),
        title: url,
      };
    }
  }

  if (domain) {
    return { domain, path: '', title: domain };
  }

  return null;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}
