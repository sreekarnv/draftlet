export interface RuntimeErrorInfo {
  code: string;
  message: string;
  retryable: boolean;
}

export interface OllamaModel {
  name: string;
  size?: number;
  digest?: string;
  modifiedAt?: string;
}

export interface InstalledModel {
  name: string;
}

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

export interface RuntimeModelRecommendation {
  model: string;
  label: string;
  description: string;
  installed: boolean;
}

export interface RuntimeModelState {
  selectedModel: string;
  defaultModel: string;
  installedModels: OllamaModel[];
  recommendations: RuntimeModelRecommendation[];
  ollamaAvailable: boolean;
  error?: RuntimeErrorInfo;
}

export interface RuntimeModelSelectionUpdate {
  selectedModel: string;
}
