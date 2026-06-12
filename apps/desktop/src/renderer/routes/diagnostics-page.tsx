import { BrowserDiagnosticsCard } from '../components/browser-diagnostics-card';
import type { BrowserDiagnosticsBridgeResult, RuntimeState } from '../lib/types';

interface DiagnosticsPageProps {
  browserDiagnostics: BrowserDiagnosticsBridgeResult | null;
  busy: boolean;
  runtime: RuntimeState;
  onCopyBrowserDiagnostics: () => Promise<void>;
  onLoadBrowserDiagnostics: () => Promise<void>;
  onOpenExtensionHelp: () => Promise<void>;
}

export function DiagnosticsPage({
  browserDiagnostics,
  busy,
  runtime,
  onCopyBrowserDiagnostics,
  onLoadBrowserDiagnostics,
  onOpenExtensionHelp,
}: DiagnosticsPageProps) {
  return (
    <section className="grid gap-3">
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
