import { RefreshCw } from 'lucide-react';

import type { ConversationThreadSnapshot, RecoverableRunProjection } from '../../core/messages';
import type { PanelCallbacks } from '../../ui/mount-panel';
import { buildThreadWorkspace, type ThreadTurnGroup } from './thread-workspace';
import { EmptyState } from './empty-state';
import {
  formatDate,
  formatSource,
  turnInstructionLabel,
} from './panel-display';
import type { PanelViewState } from './panel-types';
import { ReplyCard } from './reply-card';
import { SourceContext } from './source-context';
import { StatePill } from './state-pill';
import { Button, cn } from './ui';

interface RepliesViewProps {
  callbacks: PanelCallbacks;
  view: PanelViewState;
  onRetryInterruptedTurn: (turnId: string) => Promise<void>;
}

export function RepliesView({ callbacks, onRetryInterruptedTurn, view }: RepliesViewProps) {
  const isGenerating = view.state === 'loading' || view.state === 'streaming';

  if (view.threadSnapshot) {
    return (
      <ThreadWorkspace
        callbacks={callbacks}
        onRetryInterruptedTurn={onRetryInterruptedTurn}
        snapshot={view.threadSnapshot}
        view={view}
      />
    );
  }

  return <EmptyState title={isGenerating ? 'Waiting for streamed replies...' : 'Generated drafts will appear here.'} />;
}

function ThreadWorkspace({
  callbacks,
  onRetryInterruptedTurn,
  snapshot,
  view,
}: {
  callbacks: PanelCallbacks;
  onRetryInterruptedTurn: (turnId: string) => Promise<void>;
  snapshot: ConversationThreadSnapshot;
  view: PanelViewState;
}) {
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
        {model.groups.map((group, index) => (
          <TurnGroup
            callbacks={callbacks}
            group={group}
            index={index}
            key={group.turn.turnId}
            onRetryInterruptedTurn={onRetryInterruptedTurn}
            snapshot={snapshot}
            view={view}
          />
        ))}
      </div>
    </section>
  );
}

function TurnGroup({
  callbacks,
  group,
  index,
  onRetryInterruptedTurn,
  snapshot,
  view,
}: {
  callbacks: PanelCallbacks;
  group: ThreadTurnGroup;
  index: number;
  onRetryInterruptedTurn: (turnId: string) => Promise<void>;
  snapshot: ConversationThreadSnapshot;
  view: PanelViewState;
}) {
  const isGenerating = view.state === 'loading' || view.state === 'streaming';
  const waitingForVariants = group.isLatest && isGenerating && group.variants.length === 0;
  const projectedRecoverableRun = recoverableRunForTurn(snapshot.latestRecoverableRun, group);
  const fallbackRecoverableInterruption = !snapshot.latestRecoverableRun && group.isLatest && isRecoverableInterruptedTurn(group.turn);
  const recoverableInterruption = Boolean(projectedRecoverableRun) || fallbackRecoverableInterruption;

  return (
    <section
      aria-label={`Turn ${index + 1}`}
      className={cn(
        'grid gap-2.5 pl-3',
        group.isLatest ? 'border-l-2 border-slate-500' : 'border-l border-slate-200',
      )}
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
            <StatePill
              label={recoverableInterruption ? 'Interrupted' : group.turn.generationStatus}
              tone={group.turn.generationStatus === 'failed' ? 'rose' : 'slate'}
            />
          </div>
        </div>
        <p className="m-0 text-[13px] leading-6 text-slate-700">{turnInstructionLabel(group.turn.instruction, index)}</p>
      </div>
      {recoverableInterruption ? (
        <div className="grid gap-2 rounded-md bg-amber-50 p-3 text-[13px] leading-6 text-amber-950 ring-1 ring-amber-200">
          <div className="font-semibold">{projectedRecoverableRun ? 'Interrupted runtime run' : 'Interrupted after restart'}</div>
          {projectedRecoverableRun ? (
            <div className="break-words text-xs leading-5 text-amber-900">
              Run {projectedRecoverableRun.runId}{projectedRecoverableRun.interruptedAt ? ` · ${formatDate(projectedRecoverableRun.interruptedAt)}` : ''}
            </div>
          ) : null}
          <p className="m-0">
            {projectedRecoverableRun?.errorMessage ?? group.turn.generationErrorMessage ?? 'Draft generation stopped before completion.'} Retry starts a new run from this thread; it will not resume the old stream.
          </p>
          <Button
            className="justify-self-start"
            disabled={isGenerating}
            onClick={() => void onRetryInterruptedTurn(group.turn.turnId)}
            type="button"
            variant="secondary"
          >
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            Retry from thread
          </Button>
        </div>
      ) : null}
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

function recoverableRunForTurn(
  run: RecoverableRunProjection | undefined,
  group: ThreadTurnGroup,
): RecoverableRunProjection | undefined {
  if (!run?.recoverable || run.turnId !== group.turn.turnId || !group.isLatest) {
    return undefined;
  }

  return run;
}

function isRecoverableInterruptedTurn(turn: ThreadTurnGroup['turn']) {
  if (turn.generationStatus !== 'failed') {
    return false;
  }

  const code = turn.generationErrorCode ?? '';
  const message = turn.generationErrorMessage?.toLowerCase() ?? '';

  return code === 'generation_interrupted'
    || code === 'runtime_restarted'
    || code === 'generation_run_stale'
    || message.includes('interrupted')
    || message.includes('runtime restarted');
}
