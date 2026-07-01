import { Badge, Button, Card } from './ui';
import { formatDateTime } from '../lib/format';
import type { BrowserDiagnosticsBridgeResult } from '../lib/types';

interface BrowserDiagnosticsCardProps {
  busy: boolean;
  diagnostics: BrowserDiagnosticsBridgeResult | null;
  ready: boolean;
  onCopyBrowserDiagnostics: () => Promise<void>;
  onLoadBrowserDiagnostics: () => Promise<void>;
  onOpenExtensionHelp: () => Promise<void>;
}

export function BrowserDiagnosticsCard({
  busy,
  diagnostics,
  ready,
  onCopyBrowserDiagnostics,
  onLoadBrowserDiagnostics,
  onOpenExtensionHelp,
}: BrowserDiagnosticsCardProps) {
  const latestEntries = diagnostics?.ok ? diagnostics.report.entries.slice(-3).reverse() : [];
  const summary = diagnostics?.ok ? diagnostics.report.summary : null;
  const reportDetails = diagnostics?.ok
    ? [
        ['Kind', diagnostics.report.kind],
        ['Received', formatDateTime(diagnostics.receivedAt ?? diagnostics.report.exportedAt)],
        ['Exported', formatDateTime(diagnostics.report.exportedAt)],
        ['Last updated', formatDateTime(diagnostics.report.summary.lastUpdatedAt)],
        ['Entries', String(diagnostics.report.entries.length)],
        ['Stale window', diagnostics.staleAfterSeconds ? `${Math.round(diagnostics.staleAfterSeconds / 60)} minutes` : 'Unknown'],
      ]
    : [];

  return (
    <Card className="col-span-full content-start">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase text-slate-500">Diagnostics</p>
          <h2 className="m-0 text-base font-bold leading-tight text-slate-900">Browser insertion diagnostics</h2>
        </div>
        <Badge tone={diagnostics?.ok ? 'success' : diagnostics?.stale ? 'danger' : 'neutral'}>
          {diagnostics?.ok ? 'Report ready' : diagnostics?.stale ? 'Report expired' : ready ? 'Server ready' : 'Extension local'}
        </Badge>
      </div>
      <p className="m-0 text-sm leading-6 text-slate-600">
        Browser insertion diagnostics come from the extension. They describe selected text handling, reachable tabs, and compose-field checks.
      </p>
      <div className="grid gap-2 rounded-lg bg-slate-100 px-3 py-2 text-[13px] leading-6 text-slate-700 ring-1 ring-slate-200">
        {diagnostics?.ok ? (
          <div>
            Last report: {diagnostics.report.entries.length} entries, received {formatDateTime(diagnostics.receivedAt ?? diagnostics.report.exportedAt)}.
          </div>
        ) : (
          <div>{diagnostics?.error.message ?? 'No desktop report loaded yet.'}</div>
        )}
        {diagnostics?.staleAfterSeconds ? (
          <div>Reports expire after {Math.round(diagnostics.staleAfterSeconds / 60)} minutes.</div>
        ) : null}
        <div>The extension publishes this report during insertion-target checks when the local runtime is reachable.</div>
        <div>The report omits selected text, generated drafts, and page content.</div>
      </div>
      {summary?.currentTarget ? (
        <div className="grid gap-1.5 rounded-lg bg-white px-3 py-2 text-[13px] leading-5 text-slate-700 ring-1 ring-slate-200">
          <div className="font-semibold text-slate-900">Current target: {summary.currentTarget.status}</div>
          <div>{summary.currentTarget.message ?? 'No target message published.'}</div>
          {summary.currentTarget.candidateCount !== undefined ? <div>{summary.currentTarget.candidateCount} plausible tabs.</div> : null}
        </div>
      ) : null}
      {summary?.latestOutcome ? (
        <div className="grid gap-1.5 rounded-lg bg-white px-3 py-2 text-[13px] leading-5 text-slate-700 ring-1 ring-slate-200">
          <div className="font-semibold text-slate-900">Latest outcome: {summary.latestOutcome.status ?? summary.latestOutcome.outcome ?? summary.latestOutcome.event}</div>
          <div>{summary.latestOutcome.message}</div>
        </div>
      ) : null}
      {latestEntries.length > 0 ? (
        <div className="grid gap-1.5 text-[13px] leading-5 text-slate-700">
          {latestEntries.map((entry) => (
            <div key={entry.id} className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
              <div className="font-semibold text-slate-900">{entry.event}</div>
              <div>{entry.message}</div>
            </div>
          ))}
        </div>
      ) : null}
      {reportDetails.length > 0 ? (
        <dl className="grid gap-x-4 gap-y-1 rounded-lg bg-slate-950 px-3 py-2 text-[12px] leading-5 text-slate-200 ring-1 ring-slate-800 sm:grid-cols-[max-content_1fr]">
          {reportDetails.map(([label, value]) => (
            <div className="contents" key={label}>
              <dt className="font-semibold text-slate-400">{label}</dt>
              <dd className="m-0 min-w-0 break-words font-mono text-slate-100">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !ready} onClick={() => void onLoadBrowserDiagnostics()} type="button">
          Load browser report
        </Button>
        <Button disabled={busy || !diagnostics?.ok} onClick={() => void onCopyBrowserDiagnostics()} type="button" variant="secondary">
          Copy loaded report
        </Button>
        <Button disabled={busy} onClick={() => void onOpenExtensionHelp()} type="button" variant="secondary">
          Open extension help
        </Button>
      </div>
    </Card>
  );
}
