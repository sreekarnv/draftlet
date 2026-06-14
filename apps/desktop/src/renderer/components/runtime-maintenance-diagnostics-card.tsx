import { Badge, Button, Card } from './ui';
import type { GenerationRunMaintenanceOutcome } from '@draftlet/shared/contracts';
import type { RuntimeMaintenanceDiagnosticsResult } from '../lib/types';

interface RuntimeMaintenanceDiagnosticsCardProps {
  busy: boolean;
  diagnostics: RuntimeMaintenanceDiagnosticsResult | null;
  onLoadMaintenanceDiagnostics: () => Promise<void>;
  ready: boolean;
}

export function RuntimeMaintenanceDiagnosticsCard({
  busy,
  diagnostics,
  onLoadMaintenanceDiagnostics,
  ready,
}: RuntimeMaintenanceDiagnosticsCardProps) {
  const status = diagnostics?.ok ? diagnostics.status : null;
  const recent = status?.recent.slice(-5).reverse() ?? [];
  const hasMaintenance = Boolean(status && (
    status.latestStartup
    || status.latestStaleReconciliation
    || status.latestReplayPrune
    || status.recent.length > 0
  ));

  return (
    <Card className="col-span-full content-start">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase text-slate-500">Runtime diagnostics</p>
          <h2 className="m-0 text-base font-bold leading-tight text-slate-900">Generation run maintenance</h2>
        </div>
        <Badge tone={diagnostics?.ok ? 'success' : diagnostics ? 'danger' : 'neutral'}>
          {diagnostics?.ok ? 'Loaded' : diagnostics ? 'Unavailable' : ready ? 'Ready' : 'Server offline'}
        </Badge>
      </div>

      <p className="m-0 text-sm leading-6 text-slate-600">
        Read-only runtime maintenance status for startup interruption recovery, stale-run reconciliation, and durable replay pruning.
      </p>

      <div className="grid gap-2 rounded-lg bg-slate-100 px-3 py-2 text-[13px] leading-6 text-slate-700 ring-1 ring-slate-200">
        {diagnostics?.ok ? (
          <>
            <div>Checked {formatDateTime(diagnostics.status.checkedAt)}.</div>
            <div>{maintenanceRetentionLabel(diagnostics.status)}</div>
            {hasMaintenance ? null : <div>No generation-run maintenance outcomes are retained yet.</div>}
          </>
        ) : (
          <div>{diagnostics?.error.message ?? 'Load runtime maintenance diagnostics to inspect recent cleanup and recovery outcomes.'}</div>
        )}
      </div>

      {status ? (
        <div className="grid gap-2 md:grid-cols-3">
          <MaintenanceSummary title="Startup" outcome={status.latestStartup} />
          <MaintenanceSummary title="Stale runs" outcome={status.latestStaleReconciliation} />
          <MaintenanceSummary title="Replay pruning" outcome={status.latestReplayPrune} />
        </div>
      ) : null}

      {recent.length > 0 ? (
        <div className="grid gap-1.5 text-[13px] leading-5 text-slate-700">
          {recent.map((outcome) => (
            <div key={outcome.id} className="grid gap-1 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-slate-900">{labelForOperation(outcome.operation)}</div>
                <div className="font-mono text-[12px] text-slate-500">{formatDateTime(outcome.at)}</div>
              </div>
              <div>{summaryForOutcome(outcome)}</div>
              {outcome.errorMessage ? <div className="text-rose-700">{outcome.errorMessage}</div> : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !ready} onClick={() => void onLoadMaintenanceDiagnostics()} type="button">
          {busy ? 'Loading...' : 'Load runtime maintenance'}
        </Button>
      </div>
    </Card>
  );
}

function MaintenanceSummary({
  outcome,
  title,
}: {
  outcome?: GenerationRunMaintenanceOutcome | null;
  title: string;
}) {
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-[13px] leading-5 ring-1 ring-slate-200">
      <div className="font-semibold text-slate-900">{title}</div>
      {outcome ? (
        <>
          <div className="mt-1 text-slate-700">{summaryForOutcome(outcome)}</div>
          <div className="mt-1 font-mono text-[12px] text-slate-500">{formatDateTime(outcome.at)}</div>
        </>
      ) : (
        <div className="mt-1 text-slate-500">No recent outcome.</div>
      )}
    </div>
  );
}

function summaryForOutcome(outcome: {
  errorMessage?: string | null;
  operation: string;
  prunedEventCount: number;
  reconciledRunCount: number;
  retentionDays?: number | null;
  source?: string | null;
  status: string;
}) {
  if (outcome.status !== 'ok') {
    return `${labelForOperation(outcome.operation)} reported ${outcome.status}.`;
  }

  const parts = [];

  if (outcome.reconciledRunCount > 0 || outcome.operation !== 'replay_prune') {
    parts.push(`${outcome.reconciledRunCount} interrupted`);
  }

  if (outcome.prunedEventCount > 0 || outcome.operation !== 'stale_reconciliation') {
    parts.push(`${outcome.prunedEventCount} replay rows pruned`);
  }

  if (outcome.retentionDays !== null && outcome.retentionDays !== undefined) {
    parts.push(`${outcome.retentionDays} day retention`);
  }

  const source = outcome.source ? ` via ${outcome.source}` : '';
  return `${parts.join(', ') || 'No changes'}${source}.`;
}

function maintenanceRetentionLabel(status: {
  maxStoredOutcomes?: number;
  processLocal: boolean;
  retentionDays?: number;
}) {
  if (status.processLocal) {
    return 'Recent outcomes are process-local and reset when the Draftlet runtime restarts.';
  }

  if (status.retentionDays && status.maxStoredOutcomes) {
    return `Recent outcomes are retained for up to ${status.retentionDays} days or ${status.maxStoredOutcomes} records.`;
  }

  return 'Recent outcomes are retained by the Draftlet runtime with bounded storage.';
}

function labelForOperation(operation: string) {
  if (operation === 'startup_maintenance') {
    return 'Startup maintenance';
  }

  if (operation === 'stale_reconciliation') {
    return 'Stale reconciliation';
  }

  if (operation === 'replay_prune') {
    return 'Replay pruning';
  }

  return operation;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}
