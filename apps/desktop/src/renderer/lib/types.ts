import type { DesktopExtensionDiagnosticsBridgeResult } from '@draftlet/shared/contracts';
import type { GenerationRunMaintenanceDiagnosticsResult } from '@draftlet/shared/contracts';

export type CommandStatusCode =
  | 'ready'
  | 'missing'
  | 'not_running'
  | 'offline'
  | 'starting'
  | 'stopped'
  | 'conflict'
  | 'error'
  | 'unknown';

export interface CommandStatus {
  ok: boolean;
  message: string;
  code?: CommandStatusCode;
}

export interface InstalledModel {
  name: string;
}

export interface RuntimeState {
  ollamaInstalled: CommandStatus;
  ollamaRunning: CommandStatus;
  model: CommandStatus;
  installedModels: InstalledModel[];
  selectedModel: string;
  server: CommandStatus;
}

export interface DraftletDesktopApi {
  checkOllamaInstalled: () => Promise<CommandStatus>;
  checkOllamaRunning: () => Promise<CommandStatus>;
  checkRecommendedModelInstalled: () => Promise<CommandStatus>;
  listInstalledModels: () => Promise<InstalledModel[]>;
  getSelectedModel: () => Promise<string>;
  setSelectedModel: (model: string) => Promise<CommandStatus>;
  pullRecommendedModel: () => Promise<CommandStatus>;
  checkServerHealth: () => Promise<CommandStatus>;
  startDraftletServer: () => Promise<CommandStatus>;
  stopDraftletServer: () => Promise<CommandStatus>;
  getBrowserRecaptureDiagnosticsReport: () => Promise<DesktopExtensionDiagnosticsBridgeResult>;
  getGenerationRunMaintenanceDiagnostics: () => Promise<GenerationRunMaintenanceDiagnosticsResult>;
  getSetupComplete: () => Promise<boolean>;
  setSetupComplete: (complete: boolean) => Promise<boolean>;
  openOllamaInstallPage: () => Promise<CommandStatus>;
  openExtensionHelp: () => Promise<CommandStatus>;
  onDesktopView: (callback: (view: string) => void) => () => void;
}

export type BrowserDiagnosticsBridgeResult = DesktopExtensionDiagnosticsBridgeResult;
export type RuntimeMaintenanceDiagnosticsResult = GenerationRunMaintenanceDiagnosticsResult;

declare global {
  interface Window {
    draftlet: DraftletDesktopApi;
  }
}
