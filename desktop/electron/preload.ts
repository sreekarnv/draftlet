import { contextBridge, ipcRenderer } from "electron";

type RuntimeRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

contextBridge.exposeInMainWorld("draftlet", {
  runtime: {
    request: (path: string, init?: RuntimeRequestInit) =>
      ipcRenderer.invoke("runtime:request", path, init),
  },
});
