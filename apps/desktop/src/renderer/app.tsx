import { AppHeader } from './components/app-header';
import { HelpPage } from './routes/help-page';
import { DiagnosticsPage } from './routes/diagnostics-page';
import { RuntimePage } from './routes/runtime-page';
import { SetupPage } from './routes/setup-page';
import { useDesktopAppController } from './hooks/use-desktop-app-controller';

export default function App() {
  const { actionMessage, actions, busy, runtime } = useDesktopAppController();

  return (
    <main className="mx-auto grid max-w-[980px] gap-3.5 p-4 md:p-6">
      <AppHeader busy={busy} onRefreshStatus={actions.refreshStatus} />

      <SetupPage
        busy={busy}
        onOpenOllamaInstallPage={actions.openOllamaInstallPage}
        onPullRecommendedModel={actions.pullRecommendedModel}
        onRecheck={actions.refreshStatus}
        onSelectModel={actions.selectModel}
        runtime={runtime}
      />
      <RuntimePage
        busy={busy}
        onRestartServer={actions.restartServer}
        onStartServer={actions.startServer}
        onStopServer={actions.stopServer}
        runtime={runtime}
      />
      <DiagnosticsPage
        busy={busy}
        onCopyBrowserDiagnostics={actions.copyBrowserDiagnostics}
        onCopyDiagnosticsExport={actions.copyDiagnosticsExport}
        onLoadBrowserDiagnostics={actions.loadBrowserDiagnostics}
        onRefreshDiagnostics={actions.refreshDiagnostics}
        onLoadMaintenanceDiagnostics={actions.loadMaintenanceDiagnostics}
        onOpenExtensionHelp={actions.openExtensionHelp}
        runtime={runtime}
      />
      <HelpPage busy={busy} onOpenExtensionHelp={actions.openExtensionHelp} runtime={runtime} />
      {actionMessage ? (
        <p className="m-0 rounded-xl bg-white/90 px-3.5 py-3 text-[13px] leading-6 text-slate-700 shadow-sm shadow-slate-200/70 ring-1 ring-slate-200/80" role="status">
          {actionMessage}
        </p>
      ) : null}
    </main>
  );
}
