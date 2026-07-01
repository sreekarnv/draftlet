import type { RuntimeModelState } from '@draftlet/shared/contracts';

import { SERVER_BASE_URL } from '../constants';
import { getJson, putJson } from './transport';

interface OllamaModelRead {
  name: string;
  size?: number | null;
  digest?: string | null;
  modified_at?: string | null;
}

interface RuntimeModelRecommendationRead {
  model: string;
  label: string;
  description: string;
  installed: boolean;
}

interface RuntimeModelStateRead {
  selected_model: string;
  default_model: string;
  installed_models: OllamaModelRead[];
  recommendations: RuntimeModelRecommendationRead[];
  ollama_available: boolean;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  } | null;
}

export async function getRuntimeModelState(signal?: AbortSignal): Promise<RuntimeModelState> {
  return mapRuntimeModelState(await getJson<RuntimeModelStateRead>(`${SERVER_BASE_URL}/models/ollama`, signal));
}

export async function setRuntimeSelectedModel(selectedModel: string): Promise<RuntimeModelState> {
  return mapRuntimeModelState(await putJson<RuntimeModelStateRead>(`${SERVER_BASE_URL}/models/ollama/selection`, {
    selected_model: selectedModel,
  }));
}

function mapRuntimeModelState(state: RuntimeModelStateRead): RuntimeModelState {
  return {
    selectedModel: state.selected_model,
    defaultModel: state.default_model,
    installedModels: state.installed_models.map((model) => ({
      name: model.name,
      size: model.size ?? undefined,
      digest: model.digest ?? undefined,
      modifiedAt: model.modified_at ?? undefined,
    })),
    recommendations: state.recommendations,
    ollamaAvailable: state.ollama_available,
    error: state.error ?? undefined,
  };
}
