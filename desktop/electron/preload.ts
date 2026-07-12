import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("draftlet", {
  runtime: {
    request: (path: string, init?: RequestInit) => ipcRenderer.invoke("runtime:request", path, init),
  },
});
