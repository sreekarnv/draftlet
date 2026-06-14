import { useEffect, useState } from 'react';

import { serializeRecaptureDiagnosticsReport } from '../../../../../shared/recapture-diagnostics-contract';
import { desktopApi } from '../lib/api';
import { RECOMMENDED_MODEL } from '../lib/constants';
import {
  buildDesktopDiagnosticsExportPayload,
  serializeDesktopDiagnosticsExportPayload,
  type DesktopDiagnosticsExportPayload,
} from '../lib/diagnostics-export';
import type {
  BrowserDiagnosticsBridgeResult,
  CommandStatus,
  InstalledModel,
  RuntimeMaintenanceDiagnosticsResult,
  RuntimeState,
} from '../lib/types';
import { useDiagnosticsStore } from '../stores/diagnostics-store';

const UNKNOWN: CommandStatus = { ok: false, message: 'Not checked yet.', code: 'unknown' };

export function useDesktopAppController() {
  const [runtime, setRuntime] = useState<RuntimeState>({
    ollamaInstalled: UNKNOWN,
    ollamaRunning: UNKNOWN,
    model: UNKNOWN,
    installedModels: [],
    selectedModel: RECOMMENDED_MODEL,
    server: UNKNOWN,
  });
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const browserDiagnostics = useDiagnosticsStore((state) => state.browserDiagnostics);
  const diagnosticsLastRefreshedAt = useDiagnosticsStore((state) => state.diagnosticsLastRefreshedAt);
  const setBrowserDiagnostics = useDiagnosticsStore((state) => state.setBrowserDiagnostics);
  const setDiagnosticsRefreshing = useDiagnosticsStore((state) => state.setDiagnosticsRefreshing);
  const setMaintenanceDiagnostics = useDiagnosticsStore((state) => state.setMaintenanceDiagnostics);
  const setRefreshedDiagnostics = useDiagnosticsStore((state) => state.setRefreshedDiagnostics);
  const maintenanceDiagnostics = useDiagnosticsStore((state) => state.maintenanceDiagnostics);

  const refreshStatus = async () => {
    setBusy(true);
    setActionMessage('');

    const [ollamaInstalled, server, selectedModel] = await Promise.all([
      desktopApi.checkOllamaInstalled(),
      desktopApi.checkServerHealth(),
      desktopApi.getSelectedModel(),
    ]);

    let ollamaRunning: CommandStatus = { ok: false, message: 'Install Ollama before checking runtime status.', code: 'missing' };
    let model: CommandStatus = { ok: false, message: 'Install Ollama before checking the recommended model.', code: 'missing' };
    let installedModels: InstalledModel[] = [];

    if (ollamaInstalled.ok) {
      [ollamaRunning, model, installedModels] = await Promise.all([
        desktopApi.checkOllamaRunning(),
        desktopApi.checkRecommendedModelInstalled(),
        desktopApi.listInstalledModels().catch(() => []),
      ]);
    }

    setRuntime({ ollamaInstalled, ollamaRunning, model, installedModels, selectedModel, server });
    setBusy(false);
  };

  const openOllamaInstallPage = async () => {
    setBusy(true);
    const result = await desktopApi.openOllamaInstallPage();
    setActionMessage(result.message);
    setBusy(false);
  };

  const openExtensionHelp = async () => {
    setBusy(true);
    const result = await desktopApi.openExtensionHelp();
    setActionMessage(result.message);
    setBusy(false);
  };

  const loadBrowserDiagnostics = async () => {
    setBusy(true);
    const result = await desktopApi.getBrowserRecaptureDiagnosticsReport();
    setBrowserDiagnostics(result);
    setActionMessage(result.ok ? 'Loaded browser recapture diagnostics.' : result.error.message);
    setBusy(false);
  };

  const loadMaintenanceDiagnostics = async () => {
    setBusy(true);
    const result = await desktopApi.getGenerationRunMaintenanceDiagnostics();
    setMaintenanceDiagnostics(result);
    setActionMessage(result.ok ? 'Loaded runtime maintenance diagnostics.' : result.error.message);
    setBusy(false);
  };

  const refreshDiagnostics = async () => {
    setDiagnosticsRefreshing(true);
    setActionMessage('');

    const [browserResult, maintenanceResult] = await Promise.all([
      desktopApi.getBrowserRecaptureDiagnosticsReport(),
      desktopApi.getGenerationRunMaintenanceDiagnostics(),
    ]);

    setRefreshedDiagnostics(browserResult, maintenanceResult, new Date().toISOString());
    setActionMessage(formatDiagnosticsRefreshMessage(browserResult, maintenanceResult));
  };

  const copyBrowserDiagnostics = async () => {
    if (!browserDiagnostics?.ok) {
      setActionMessage('Load a browser diagnostics report before copying.');
      return;
    }

    try {
      await navigator.clipboard.writeText(serializeRecaptureDiagnosticsReport(browserDiagnostics.report));
      setActionMessage('Copied browser recapture diagnostics.');
    } catch {
      setActionMessage('Could not copy browser recapture diagnostics.');
    }
  };

  const copyDiagnosticsExport = async () => {
    const payload = buildDesktopDiagnosticsExportPayload({
      browserDiagnostics,
      diagnosticsLastRefreshedAt,
      maintenanceDiagnostics,
      runtime,
    });

    try {
      await navigator.clipboard.writeText(serializeDesktopDiagnosticsExportPayload(payload));
      setActionMessage(formatDiagnosticsExportMessage(payload));
    } catch {
      setActionMessage('Could not copy diagnostics export.');
    }
  };

  const selectModel = async (model: string) => {
    setBusy(true);
    const result = await desktopApi.setSelectedModel(model);
    setActionMessage(result.message);
    await refreshStatus();
  };

  const pullRecommendedModel = async () => {
    setBusy(true);
    setActionMessage(`Pulling ${RECOMMENDED_MODEL}. This can take a while...`);
    const result = await desktopApi.pullRecommendedModel();
    setActionMessage(result.message);
    await refreshStatus();
  };

  const startServer = async () => {
    setBusy(true);
    const result = await desktopApi.startDraftletServer();
    setActionMessage(result.message);
    await refreshStatus();
  };

  const stopServer = async () => {
    setBusy(true);
    const result = await desktopApi.stopDraftletServer();
    setActionMessage(result.message);
    await refreshStatus();
  };

  const restartServer = async () => {
    setBusy(true);
    const stopResult = await desktopApi.stopDraftletServer();
    const startResult = await desktopApi.startDraftletServer();
    setActionMessage(`${stopResult.message} ${startResult.message}`);
    await refreshStatus();
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  return {
    actionMessage,
    actions: {
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
  };
}

function formatDiagnosticsRefreshMessage(
  browserDiagnostics: BrowserDiagnosticsBridgeResult,
  maintenanceDiagnostics: RuntimeMaintenanceDiagnosticsResult,
) {
  if (browserDiagnostics.ok && maintenanceDiagnostics.ok) {
    return 'Loaded browser and runtime diagnostics.';
  }

  if (browserDiagnostics.ok && !maintenanceDiagnostics.ok) {
    return `Loaded browser diagnostics. Runtime maintenance unavailable: ${maintenanceDiagnostics.error.message}`;
  }

  if (!browserDiagnostics.ok && maintenanceDiagnostics.ok) {
    return `Loaded runtime maintenance diagnostics. Browser recapture unavailable: ${browserDiagnostics.error.message}`;
  }

  if (!browserDiagnostics.ok && !maintenanceDiagnostics.ok) {
    return `Could not load diagnostics. Browser: ${browserDiagnostics.error.message} Runtime: ${maintenanceDiagnostics.error.message}`;
  }

  return 'Diagnostics refresh finished.';
}

function formatDiagnosticsExportMessage(payload: DesktopDiagnosticsExportPayload) {
  const loadedCount = [
    payload.availability.browser_recapture_diagnostics,
    payload.availability.generation_run_maintenance_diagnostics,
  ].filter((status) => status === 'loaded').length;

  if (loadedCount === 2) {
    return 'Copied diagnostics export with browser recapture and runtime maintenance diagnostics.';
  }

  if (loadedCount === 1) {
    return 'Copied diagnostics export with 1 of 2 diagnostics sources loaded.';
  }

  return 'Copied diagnostics export. Diagnostics sources are marked not loaded or unavailable.';
}
