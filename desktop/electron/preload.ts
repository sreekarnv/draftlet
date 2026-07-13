import { contextBridge, ipcRenderer } from "electron";

type RuntimeRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

type RuntimeEvent = Record<string, unknown> & { type?: string };

contextBridge.exposeInMainWorld("draftlet", {
  runtime: {
    request: (path: string, init?: RuntimeRequestInit) =>
      ipcRenderer.invoke("runtime:request", path, init),
    onEvent: (callback: (event: RuntimeEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, runtimeEvent: RuntimeEvent) => {
        callback(runtimeEvent);
      };
      ipcRenderer.on("runtime:event", listener);
      return () => ipcRenderer.removeListener("runtime:event", listener);
    },
  },
});
