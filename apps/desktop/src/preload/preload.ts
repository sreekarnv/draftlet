import { contextBridge, ipcRenderer } from 'electron';

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
  openOllamaInstallPage: () => ipcRenderer.invoke('draftlet:open-ollama-install-page'),
  openExtensionHelp: () => ipcRenderer.invoke('draftlet:open-extension-help'),
};

contextBridge.exposeInMainWorld('draftlet', api);
