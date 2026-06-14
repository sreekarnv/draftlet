import { create } from 'zustand';

import type { BrowserDiagnosticsBridgeResult, RuntimeMaintenanceDiagnosticsResult } from '../lib/types';

interface DiagnosticsState {
  browserDiagnostics: BrowserDiagnosticsBridgeResult | null;
  diagnosticsLastRefreshedAt: string | null;
  diagnosticsRefreshing: boolean;
  maintenanceDiagnostics: RuntimeMaintenanceDiagnosticsResult | null;
  setBrowserDiagnostics: (diagnostics: BrowserDiagnosticsBridgeResult | null) => void;
  setDiagnosticsRefreshing: (refreshing: boolean) => void;
  setMaintenanceDiagnostics: (diagnostics: RuntimeMaintenanceDiagnosticsResult | null) => void;
  setRefreshedDiagnostics: (
    browserDiagnostics: BrowserDiagnosticsBridgeResult,
    maintenanceDiagnostics: RuntimeMaintenanceDiagnosticsResult,
    refreshedAt: string,
  ) => void;
}

export const useDiagnosticsStore = create<DiagnosticsState>((set) => ({
  browserDiagnostics: null,
  diagnosticsLastRefreshedAt: null,
  diagnosticsRefreshing: false,
  maintenanceDiagnostics: null,
  setBrowserDiagnostics: (browserDiagnostics) => set({ browserDiagnostics }),
  setDiagnosticsRefreshing: (diagnosticsRefreshing) => set({ diagnosticsRefreshing }),
  setMaintenanceDiagnostics: (maintenanceDiagnostics) => set({ maintenanceDiagnostics }),
  setRefreshedDiagnostics: (browserDiagnostics, maintenanceDiagnostics, diagnosticsLastRefreshedAt) => set({
    browserDiagnostics,
    diagnosticsLastRefreshedAt,
    diagnosticsRefreshing: false,
    maintenanceDiagnostics,
  }),
}));
