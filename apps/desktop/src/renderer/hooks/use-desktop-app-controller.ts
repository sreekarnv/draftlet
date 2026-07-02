import { useEffect } from 'react';

import {
  bindInitialStatusLoad,
  completeSetup,
  copyBrowserDiagnostics,
  copyDiagnosticsExport,
  loadBrowserDiagnostics,
  loadMaintenanceDiagnostics,
  openExtensionHelp,
  openOllamaInstallPage,
  pullRecommendedModel,
  refreshDiagnostics,
  refreshStatus,
  restartServer,
  selectModel,
  startServer,
  stopServer,
} from '../lib/actions';
import { useAppStatusStore } from '../stores/app-status-store';
import { useRuntimeStore } from '../stores/runtime-store';

export function useDesktopAppController() {
  const actionMessage = useAppStatusStore((state) => state.actionMessage);
  const busy = useAppStatusStore((state) => state.busy);
  const setupComplete = useAppStatusStore((state) => state.setupComplete);
  const runtime = useRuntimeStore();

  useEffect(() => {
    bindInitialStatusLoad();
  }, []);

  return {
    actionMessage,
    actions: {
      completeSetup,
      copyBrowserDiagnostics,
      copyDiagnosticsExport,
      loadBrowserDiagnostics,
      loadMaintenanceDiagnostics,
      openExtensionHelp,
      openOllamaInstallPage,
      pullRecommendedModel,
      refreshDiagnostics,
      refreshStatus,
      restartServer,
      selectModel,
      startServer,
      stopServer,
    },
    busy,
    runtime,
    setupComplete,
  };
}
