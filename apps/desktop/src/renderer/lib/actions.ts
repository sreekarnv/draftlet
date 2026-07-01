import { serializeRecaptureDiagnosticsReport } from '@draftlet/shared/contracts';

import { RECOMMENDED_MODEL } from './constants';
import { buildDesktopDiagnosticsExportPayload, serializeDesktopDiagnosticsExportPayload, type DesktopDiagnosticsExportPayload } from './diagnostics-export';
import {
  formatDiagnosticsExportMessage,
  formatDiagnosticsRefreshMessage,
} from './diagnostics-messages';
import type {
  BrowserDiagnosticsBridgeResult,
  CommandStatus,
  InstalledModel,
  RuntimeMaintenanceDiagnosticsResult,
  RuntimeState,
} from './types';
import { useAppStatusStore } from '../stores/app-status-store';
import { useDiagnosticsStore } from '../stores/diagnostics-store';
import { useRuntimeStore } from '../stores/runtime-store';

const desktopApi = window.draftlet;

function isRuntimeReady(value: CommandStatus): boolean {
  return value.ok;
}

async function refreshRuntimeStatus(): Promise<void> {
  const setBusy = useAppStatusStore.getState().setBusy;
  const setActionMessage = useAppStatusStore.getState().setActionMessage;
  const setRuntime = useRuntimeStore.getState().setRuntime;

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

  if (isRuntimeReady(ollamaInstalled)) {
    [ollamaRunning, model, installedModels] = await Promise.all([
      desktopApi.checkOllamaRunning(),
      desktopApi.checkRecommendedModelInstalled(),
      desktopApi.listInstalledModels().catch(() => []),
    ]);
  }

  setRuntime({ ollamaInstalled, ollamaRunning, model, installedModels, selectedModel, server });
  setBusy(false);
}

export async function refreshStatus(): Promise<void> {
  await refreshRuntimeStatus();
}

export async function openOllamaInstallPage(): Promise<void> {
  const { setBusy, setActionMessage } = useAppStatusStore.getState();
  setBusy(true);
  const result = await desktopApi.openOllamaInstallPage();
  setActionMessage(result.message);
  setBusy(false);
}

export async function openExtensionHelp(): Promise<void> {
  const { setBusy, setActionMessage } = useAppStatusStore.getState();
  setBusy(true);
  const result = await desktopApi.openExtensionHelp();
  setActionMessage(result.message);
  setBusy(false);
}

export async function loadBrowserDiagnostics(): Promise<void> {
  const { setBusy, setActionMessage } = useAppStatusStore.getState();
  const setBrowserDiagnostics = useDiagnosticsStore.getState().setBrowserDiagnostics;

  setBusy(true);
  const result = await desktopApi.getBrowserRecaptureDiagnosticsReport();
  setBrowserDiagnostics(result);
  setActionMessage(result.ok ? 'Loaded browser insertion diagnostics.' : result.error.message);
  setBusy(false);
}

export async function loadMaintenanceDiagnostics(): Promise<void> {
  const { setBusy, setActionMessage } = useAppStatusStore.getState();
  const setMaintenanceDiagnostics = useDiagnosticsStore.getState().setMaintenanceDiagnostics;

  setBusy(true);
  const result = await desktopApi.getGenerationRunMaintenanceDiagnostics();
  setMaintenanceDiagnostics(result);
  setActionMessage(result.ok ? 'Loaded draft recovery diagnostics.' : result.error.message);
  setBusy(false);
}

export async function refreshDiagnostics(): Promise<void> {
  const { setDiagnosticsRefreshing, setRefreshedDiagnostics } = useDiagnosticsStore.getState();
  const { setActionMessage } = useAppStatusStore.getState();

  setDiagnosticsRefreshing(true);
  setActionMessage('');

  const [browserResult, maintenanceResult] = await Promise.all([
    desktopApi.getBrowserRecaptureDiagnosticsReport(),
    desktopApi.getGenerationRunMaintenanceDiagnostics(),
  ]);

  setRefreshedDiagnostics(browserResult, maintenanceResult, new Date().toISOString());
  setActionMessage(formatDiagnosticsRefreshMessage(browserResult, maintenanceResult));
}

export async function copyBrowserDiagnostics(): Promise<void> {
  const { setActionMessage } = useAppStatusStore.getState();
  const browserDiagnostics = useDiagnosticsStore.getState().browserDiagnostics;

  if (!browserDiagnostics?.ok) {
    setActionMessage('Load a browser diagnostics report before copying.');
    return;
  }

  try {
    await navigator.clipboard.writeText(serializeRecaptureDiagnosticsReport(browserDiagnostics.report));
    setActionMessage('Copied browser insertion diagnostics.');
  } catch {
    setActionMessage('Could not copy browser insertion diagnostics.');
  }
}

export async function copyDiagnosticsExport(): Promise<void> {
  const { browserDiagnostics, diagnosticsLastRefreshedAt, maintenanceDiagnostics } = useDiagnosticsStore.getState();
  const runtime = useRuntimeStore.getState();
  const { setActionMessage } = useAppStatusStore.getState();

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
}

export async function selectModel(model: string): Promise<void> {
  const { setBusy, setActionMessage } = useAppStatusStore.getState();
  setBusy(true);
  const result = await desktopApi.setSelectedModel(model);
  setActionMessage(result.message);
  await refreshRuntimeStatus();
}

export async function pullRecommendedModel(): Promise<void> {
  const { setBusy, setActionMessage } = useAppStatusStore.getState();
  setBusy(true);
  setActionMessage(`Pulling ${RECOMMENDED_MODEL}. This can take a while...`);
  const result = await desktopApi.pullRecommendedModel();
  setActionMessage(result.message);
  await refreshRuntimeStatus();
}

export async function startServer(): Promise<void> {
  const { setBusy, setActionMessage } = useAppStatusStore.getState();
  setBusy(true);
  const result = await desktopApi.startDraftletServer();
  setActionMessage(result.message);
  await refreshRuntimeStatus();
}

export async function stopServer(): Promise<void> {
  const { setBusy, setActionMessage } = useAppStatusStore.getState();
  setBusy(true);
  const result = await desktopApi.stopDraftletServer();
  setActionMessage(result.message);
  await refreshRuntimeStatus();
}

export async function restartServer(): Promise<void> {
  const { setBusy, setActionMessage } = useAppStatusStore.getState();
  setBusy(true);
  const stopResult = await desktopApi.stopDraftletServer();
  const startResult = await desktopApi.startDraftletServer();
  setActionMessage(`${stopResult.message} ${startResult.message}`);
  await refreshRuntimeStatus();
}

export async function completeSetup(): Promise<void> {
  const { setBusy, setActionMessage, setSetupComplete } = useAppStatusStore.getState();
  setBusy(true);
  await desktopApi.setSetupComplete(true);
  setSetupComplete(true);
  const startResult = await desktopApi.startDraftletServer();
  setActionMessage(`${startResult.message} Setup is complete. Draftlet will start from the tray on future launches.`);
  await refreshRuntimeStatus();
}

export function bindInitialStatusLoad(): void {
  void refreshRuntimeStatus();
  void desktopApi.getSetupComplete().then((complete) => {
    useAppStatusStore.getState().setSetupComplete(complete);
  });
}

export function selectRuntimeSnapshot(): RuntimeState {
  const { ollamaInstalled, ollamaRunning, model, installedModels, selectedModel, server } = useRuntimeStore.getState();
  return { ollamaInstalled, ollamaRunning, model, installedModels, selectedModel, server };
}

export type { BrowserDiagnosticsBridgeResult, RuntimeMaintenanceDiagnosticsResult };
export type DiagnosticsExportPayload = DesktopDiagnosticsExportPayload;
