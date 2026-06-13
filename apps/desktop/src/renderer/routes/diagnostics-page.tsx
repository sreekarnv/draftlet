import { BrowserDiagnosticsCard } from '../components/browser-diagnostics-card';
import { RuntimeMaintenanceDiagnosticsCard } from '../components/runtime-maintenance-diagnostics-card';
import type { BrowserDiagnosticsBridgeResult, RuntimeMaintenanceDiagnosticsResult, RuntimeState } from '../lib/types';

interface DiagnosticsPageProps {
  browserDiagnostics: BrowserDiagnosticsBridgeResult | null;
  busy: boolean;
  maintenanceDiagnostics: RuntimeMaintenanceDiagnosticsResult | null;
  runtime: RuntimeState;
  onCopyBrowserDiagnostics: () => Promise<void>;
  onLoadBrowserDiagnostics: () => Promise<void>;
  onLoadMaintenanceDiagnostics: () => Promise<void>;
  onOpenExtensionHelp: () => Promise<void>;
}

export function DiagnosticsPage({
  browserDiagnostics,
  busy,
  maintenanceDiagnostics,
  runtime,
  onCopyBrowserDiagnostics,
  onLoadBrowserDiagnostics,
  onLoadMaintenanceDiagnostics,
  onOpenExtensionHelp,
}: DiagnosticsPageProps) {
  return (
    <section className="grid gap-3">
      <RuntimeMaintenanceDiagnosticsCard
        busy={busy}
        diagnostics={maintenanceDiagnostics}
        onLoadMaintenanceDiagnostics={onLoadMaintenanceDiagnostics}
        ready={runtime.server.ok}
      />
      <BrowserDiagnosticsCard
        diagnostics={browserDiagnostics}
        busy={busy}
        onCopyBrowserDiagnostics={onCopyBrowserDiagnostics}
        onLoadBrowserDiagnostics={onLoadBrowserDiagnostics}
        onOpenExtensionHelp={onOpenExtensionHelp}
        ready={runtime.server.ok}
      />
    </section>
  );
}
