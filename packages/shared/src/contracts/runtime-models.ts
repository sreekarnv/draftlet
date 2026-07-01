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
