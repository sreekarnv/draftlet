import type { BrowserRecaptureDiagnosticsRelayState } from './recapture-diagnostics';
import type { GenerationRunMaintenanceStatus } from './generation-run-maintenance-diagnostics';

export interface RuntimeStatusBundle {
  runtimeVersion: string;
  schemaVersion: string;
  apiVersion: string;
  serverPort: number;
}

export interface ModelsBundle {
  defaultModel: string;
  selectedModel: string;
  availableModels: string[];
  ollamaAvailable: boolean;
  ollamaErrorCode?: string;
  ollamaErrorMessage?: string;
}

export interface CountsBundle {
  workspaceSessions: number;
  conversationThreads: number;
  turns: number;
  draftVariants: number;
  generationRuns: number;
}

export interface PreferenceBundleEntry {
  scope: string;
  key: string;
  updatedAt: string;
}

export interface PreferencesBundle {
  entries: PreferenceBundleEntry[];
}

export interface SupportBundle {
  capturedAt: string;
  runtime: RuntimeStatusBundle;
  models: ModelsBundle;
  recapture: BrowserRecaptureDiagnosticsRelayState;
  maintenance: GenerationRunMaintenanceStatus;
  preferences: PreferencesBundle;
  counts: CountsBundle;
}
