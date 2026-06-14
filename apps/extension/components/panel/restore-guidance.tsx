import { RefreshCw } from 'lucide-react';

import type { WorkspaceRecoveryAction, WorkspaceRestoreState } from '../../core/messages';
import { restoreGuidanceToneClass } from './panel-display';
import { Button, cn } from './ui';

interface RestoreGuidanceProps {
  restoreState: WorkspaceRestoreState | null;
  onRecaptureInsertionTarget: (tabId?: number) => Promise<void>;
  onRetryInterruptedTurn: (turnId: string) => Promise<void>;
}

export function RestoreGuidance({
  onRecaptureInsertionTarget,
  onRetryInterruptedTurn,
  restoreState,
}: RestoreGuidanceProps) {
  if (!restoreState || restoreState.status === 'ready') {
    return null;
  }

  const visibleIssues = restoreState.issues
    .filter((issue) => issue.code !== 'restored_session' && issue.code !== 'restored_thread')
    .slice(0, 3);

  return (
    <div className={cn(
      'grid gap-2 rounded-md p-2.5 text-[12px] leading-5 ring-1',
      restoreGuidanceToneClass(restoreState.status),
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{restoreState.summary}</div>
          {visibleIssues.length > 0 ? (
            <div className="mt-1 grid gap-0.5 text-[11px] leading-4">
              {visibleIssues.map((issue) => (
                <div className="min-w-0 truncate" key={`${issue.code}-${issue.runId ?? issue.turnId ?? issue.threadId ?? ''}`} title={issue.message}>
                  {issue.message}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <RestorePrimaryAction
          action={restoreState.primaryAction}
          onRecaptureInsertionTarget={onRecaptureInsertionTarget}
          onRetryInterruptedTurn={onRetryInterruptedTurn}
        />
      </div>
    </div>
  );
}

function RestorePrimaryAction({
  action,
  onRecaptureInsertionTarget,
  onRetryInterruptedTurn,
}: {
  action: WorkspaceRecoveryAction | undefined;
  onRecaptureInsertionTarget: (tabId?: number) => Promise<void>;
  onRetryInterruptedTurn: (turnId: string) => Promise<void>;
}) {
  if (!action) {
    return null;
  }

  if (action.kind === 'recapture_target') {
    return (
      <Button
        className="h-7 shrink-0 px-2.5 text-[11px] leading-4"
        onClick={() => void onRecaptureInsertionTarget()}
        title={action.message}
        type="button"
        variant="secondary"
      >
        <RefreshCw aria-hidden="true" className="h-3 w-3" />
        {action.label}
      </Button>
    );
  }

  if (action.kind === 'retry_interrupted_run' && action.turnId) {
    return (
      <Button
        className="h-7 shrink-0 px-2.5 text-[11px] leading-4"
        onClick={() => void onRetryInterruptedTurn(action.turnId!)}
        title={action.message}
        type="button"
        variant="secondary"
      >
        <RefreshCw aria-hidden="true" className="h-3 w-3" />
        {action.label}
      </Button>
    );
  }

  return (
    <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold leading-4 text-slate-600 ring-1 ring-slate-200">
      {action.label}
    </span>
  );
}
