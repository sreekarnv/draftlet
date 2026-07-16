/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string;
    /** /dist/ or /public/ */
    VITE_PUBLIC: string;
  }
}

interface Window {
  draftlet?: {
    runtime: {
      request: (
        path: string,
        init?: { method?: string; headers?: Record<string, string>; body?: string },
      ) => Promise<{ ok: boolean; status: number; body: string }>;
      onEvent: (
        callback: (event: Record<string, unknown> & { type?: string }) => void,
      ) => () => void;
    };
  };
}
