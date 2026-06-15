import { FileText, RefreshCw, Sparkles } from 'lucide-react';

import type { Tone } from '../../core/types';
import type { PanelCallbacks } from '../../ui/mount-panel';
import { RefinementForm } from './refinement-form';
import { RestoreGuidance } from './restore-guidance';
import { TargetStatus } from './target-status';
import { ToneTabs } from './tone-tabs';
import { draftCount, getStateText, stateToneClass } from './panel-display';
import type { PanelViewState } from './panel-types';
import { Button, cn } from './ui';

interface ComposerWorkspaceProps {
  callbacks: PanelCallbacks;
  view: PanelViewState;
  onRetryInterruptedTurn: (turnId: string) => Promise<void>;
  onSelectTone: (tone: Tone) => void;
}

export function ComposerWorkspace({
  callbacks,
  onRetryInterruptedTurn,
  onSelectTone,
  view,
}: ComposerWorkspaceProps) {
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
          <div className="grid justify-items-end gap-1 text-right">
            <div className={cn('text-xs font-semibold leading-5 text-slate-500', stateToneClass(view.state))}>{getStateText(view)}</div>
            <TargetStatus view={view} />
          </div>
        </div>
        <p className="m-0 max-h-[4.75rem] overflow-hidden text-[13.5px] leading-6 text-slate-800">{view.selectedText}</p>
      </div>
      <RestoreGuidance
        onRetryInterruptedTurn={onRetryInterruptedTurn}
        restoreState={view.restoreState}
      />
      <div className="grid gap-2">
        <ToneTabs onSelect={onSelectTone} selectedTone={view.tone} />
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
          <RefinementForm disabled={isGenerating} onRefine={callbacks.onRefine} />
        ) : null}
      </div>
    </section>
  );
}
