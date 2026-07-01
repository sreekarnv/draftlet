import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

const api = {
  checkOllamaInstalled: () => ipcRenderer.invoke('draftlet:check-ollama-installed'),
  checkOllamaRunning: () => ipcRenderer.invoke('draftlet:check-ollama-running'),
  checkRecommendedModelInstalled: () => ipcRenderer.invoke('draftlet:check-recommended-model-installed'),
  listInstalledModels: () => ipcRenderer.invoke('draftlet:list-installed-models'),
  getSelectedModel: () => ipcRenderer.invoke('draftlet:get-selected-model'),
  setSelectedModel: (model: string) => ipcRenderer.invoke('draftlet:set-selected-model', model),
  pullRecommendedModel: () => ipcRenderer.invoke('draftlet:pull-recommended-model'),
  checkServerHealth: () => ipcRenderer.invoke('draftlet:check-server-health'),
  startDraftletServer: () => ipcRenderer.invoke('draftlet:start-server'),
  stopDraftletServer: () => ipcRenderer.invoke('draftlet:stop-server'),
  getBrowserRecaptureDiagnosticsReport: () => ipcRenderer.invoke('draftlet:get-browser-recapture-diagnostics-report'),
  getGenerationRunMaintenanceDiagnostics: () => ipcRenderer.invoke('draftlet:get-generation-run-maintenance-diagnostics'),
  getSetupComplete: () => ipcRenderer.invoke('draftlet:get-setup-complete'),
  setSetupComplete: (complete: boolean) => ipcRenderer.invoke('draftlet:set-setup-complete', complete),
  openOllamaInstallPage: () => ipcRenderer.invoke('draftlet:open-ollama-install-page'),
  openExtensionHelp: () => ipcRenderer.invoke('draftlet:open-extension-help'),
  onDesktopView: (callback: (view: string) => void) => {
    const listener = (_event: IpcRendererEvent, view: string) => callback(view);
    ipcRenderer.on('draftlet:desktop-view', listener);
    return () => ipcRenderer.removeListener('draftlet:desktop-view', listener);
  },
};

contextBridge.exposeInMainWorld('draftlet', api);
