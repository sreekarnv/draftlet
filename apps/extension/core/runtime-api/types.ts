import type {
  DraftVariant,
  GenerationRunLiveFeedAttachment,
  GenerationRunStatus,
  Turn,
} from '@draftlet/shared/contracts';

export function isTone(value: string): value is DraftVariant['tone'] {
  return value === 'professional'
    || value === 'casual'
    || value === 'short'
    || value === 'bullet_points'
    || value === 'custom'
    || value === 'friendly'
    || value === 'concise';
}

export function isTurnStatus(value: string): value is Turn['generationStatus'] {
  return value === 'queued' || value === 'started' || value === 'streaming' || value === 'completed' || value === 'failed' || value === 'cancelled';
}

export function isGenerationRunStatus(value: string): value is GenerationRunStatus {
  return value === 'active' || value === 'streaming' || value === 'completed' || value === 'failed' || value === 'cancelled' || value === 'interrupted';
}

export function isGenerationRunLiveFeedAttachmentMode(value: string | undefined): value is GenerationRunLiveFeedAttachment['mode'] {
  return value === 'live_attached' || value === 'replay_only' || value === 'stale';
}
