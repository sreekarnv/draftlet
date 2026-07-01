import type {
  CommandStatus,
  CommandStatusCode,
  DesktopExtensionDiagnosticsBridgeResult,
  GenerationRunMaintenanceDiagnosticsResult,
  InstalledModel,
} from '@draftlet/shared/contracts';

export type { CommandStatus, CommandStatusCode, InstalledModel };

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
