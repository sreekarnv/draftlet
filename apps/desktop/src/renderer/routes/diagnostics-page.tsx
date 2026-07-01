import { BrowserDiagnosticsCard } from '../components/browser-diagnostics-card';
import { RuntimeMaintenanceDiagnosticsCard } from '../components/runtime-maintenance-diagnostics-card';
import { Badge, Button, Card } from '../components/ui';
import { formatDateTime } from '../lib/format';
import { useDiagnosticsStore } from '../stores/diagnostics-store';
import type { BrowserDiagnosticsBridgeResult, RuntimeMaintenanceDiagnosticsResult, RuntimeState } from '../lib/types';

interface DiagnosticsPageProps {
  busy: boolean;
  runtime: RuntimeState;
  onCopyBrowserDiagnostics: () => Promise<void>;
  onCopyDiagnosticsExport: () => Promise<void>;
  onLoadBrowserDiagnostics: () => Promise<void>;
  onLoadMaintenanceDiagnostics: () => Promise<void>;
  onOpenExtensionHelp: () => Promise<void>;
  onRefreshDiagnostics: () => Promise<void>;
}

export function DiagnosticsPage({
  busy,
  runtime,
  onCopyBrowserDiagnostics,
  onCopyDiagnosticsExport,
  onLoadBrowserDiagnostics,
  onLoadMaintenanceDiagnostics,
  onOpenExtensionHelp,
  onRefreshDiagnostics,
}: DiagnosticsPageProps) {
  const browserDiagnostics = useDiagnosticsStore((state) => state.browserDiagnostics);
  const diagnosticsLastRefreshedAt = useDiagnosticsStore((state) => state.diagnosticsLastRefreshedAt);
  const diagnosticsRefreshing = useDiagnosticsStore((state) => state.diagnosticsRefreshing);
  const maintenanceDiagnostics = useDiagnosticsStore((state) => state.maintenanceDiagnostics);

  return (
    <section className="grid gap-3">
      <DiagnosticsRefreshGroup
        browserDiagnostics={browserDiagnostics}
        busy={busy}
        diagnosticsLastRefreshedAt={diagnosticsLastRefreshedAt}
        diagnosticsRefreshing={diagnosticsRefreshing}
        maintenanceDiagnostics={maintenanceDiagnostics}
        onCopyDiagnosticsExport={onCopyDiagnosticsExport}
        onRefreshDiagnostics={onRefreshDiagnostics}
        ready={runtime.server.ok}
      />
      <RuntimeMaintenanceDiagnosticsCard
        busy={busy || diagnosticsRefreshing}
        diagnostics={maintenanceDiagnostics}
        onLoadMaintenanceDiagnostics={onLoadMaintenanceDiagnostics}
        ready={runtime.server.ok}
      />
      <BrowserDiagnosticsCard
        diagnostics={browserDiagnostics}
        busy={busy || diagnosticsRefreshing}
        onCopyBrowserDiagnostics={onCopyBrowserDiagnostics}
        onLoadBrowserDiagnostics={onLoadBrowserDiagnostics}
        onOpenExtensionHelp={onOpenExtensionHelp}
        ready={runtime.server.ok}
      />
    </section>
  );
}

function DiagnosticsRefreshGroup({
  browserDiagnostics,
  busy,
  diagnosticsLastRefreshedAt,
  diagnosticsRefreshing,
  maintenanceDiagnostics,
  onCopyDiagnosticsExport,
  onRefreshDiagnostics,
  ready,
}: {
  browserDiagnostics: BrowserDiagnosticsBridgeResult | null;
  busy: boolean;
  diagnosticsLastRefreshedAt: string | null;
  diagnosticsRefreshing: boolean;
  maintenanceDiagnostics: RuntimeMaintenanceDiagnosticsResult | null;
  onCopyDiagnosticsExport: () => Promise<void>;
  onRefreshDiagnostics: () => Promise<void>;
  ready: boolean;
}) {
  const browserLoaded = browserDiagnostics?.ok === true;
  const maintenanceLoaded = maintenanceDiagnostics?.ok === true;
  const browserChecked = browserDiagnostics !== null;
  const maintenanceChecked = maintenanceDiagnostics !== null;
  const loadedCount = Number(browserLoaded) + Number(maintenanceLoaded);
  const checkedCount = Number(browserChecked) + Number(maintenanceChecked);
  const statusText = diagnosticsRefreshing
    ? 'Refreshing diagnostics...'
    : checkedCount === 0
      ? 'Diagnostics have not been refreshed yet.'
      : `${loadedCount} of 2 diagnostics sources loaded.`;

  return (
    <Card className="col-span-full content-start">
      <div className="flex items-start justify-between gap-3 max-sm:grid">
        <div>
          <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase text-slate-500">Diagnostics refresh</p>
          <h2 className="m-0 text-base font-bold leading-tight text-slate-900">Operational signals</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || diagnosticsRefreshing || !ready} onClick={() => void onRefreshDiagnostics()} type="button">
            {diagnosticsRefreshing ? 'Refreshing...' : 'Refresh diagnostics'}
          </Button>
          <Button disabled={busy || diagnosticsRefreshing} onClick={() => void onCopyDiagnosticsExport()} type="button" variant="secondary">
            Copy debug export
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge tone={badgeTone(browserDiagnostics)}>
          Browser insertion: {sourceStatusLabel(browserDiagnostics)}
        </Badge>
        <Badge tone={badgeTone(maintenanceDiagnostics)}>
          Draft recovery: {sourceStatusLabel(maintenanceDiagnostics)}
        </Badge>
      </div>
      <div className="grid gap-1 rounded-lg bg-slate-100 px-3 py-2 text-[13px] leading-6 text-slate-700 ring-1 ring-slate-200">
        <div>{ready ? statusText : 'Start the Draftlet server to refresh runtime-backed diagnostics.'}</div>
        {diagnosticsLastRefreshedAt ? <div>Last refreshed {formatDateTime(diagnosticsLastRefreshedAt)}.</div> : null}
        {browserDiagnostics && !browserDiagnostics.ok ? <div>Browser insertion: {browserDiagnostics.error.message}</div> : null}
        {maintenanceDiagnostics && !maintenanceDiagnostics.ok ? <div>Draft recovery: {maintenanceDiagnostics.error.message}</div> : null}
        <div>Debug export copies the currently loaded state and does not refresh diagnostics.</div>
      </div>
    </Card>
  );
}

function badgeTone(result: BrowserDiagnosticsBridgeResult | RuntimeMaintenanceDiagnosticsResult | null) {
  if (!result) {
    return 'neutral';
  }

  return result.ok ? 'success' : 'danger';
}

function sourceStatusLabel(result: BrowserDiagnosticsBridgeResult | RuntimeMaintenanceDiagnosticsResult | null) {
  if (!result) {
    return 'Not loaded';
  }

  return result.ok ? 'Loaded' : 'Unavailable';
}
