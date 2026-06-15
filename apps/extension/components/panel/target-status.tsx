import { cn } from './ui';
import { targetStatusLabel, targetToneClass } from './panel-display';
import type { PanelViewState } from './panel-types';

interface TargetStatusProps {
  view: PanelViewState;
}

export function TargetStatus({ view }: TargetStatusProps) {
  return (
    <div className="grid justify-items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <div
          className={cn('text-[11px] font-medium leading-4', targetToneClass(view.insertionTarget.status))}
          title={view.insertionTarget.message}
        >
          {targetStatusLabel(view.insertionTarget)}
        </div>
      </div>
      {view.insertionTarget.message && view.insertionTarget.status !== 'live' ? (
        <p className="m-0 max-w-[17rem] text-right text-[11px] leading-4 text-slate-500">
          {view.insertionTarget.message}
        </p>
      ) : null}
    </div>
  );
}
