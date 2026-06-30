import { SERVER_BASE_URL } from '../constants';
import type {
  GenerationRun,
  GenerationRunExecutionState,
  GenerationRunProgressSnapshot,
  GenerationRunStatus,
} from '@draftlet/shared/contracts';
import { getJson, patchJson, postJson, putJson } from './transport';
import {
  mapGenerationRun,
  mapGenerationRunProgressSnapshot,
  mapGenerationRunRestoreCandidate,
  type GenerationRunExecutionStateRead,
  type GenerationRunProgressSnapshotRead,
  type GenerationRunRead,
} from './mappers';

export async function claimGenerationRun(run: {
  runId: string;
  sessionId: string;
  threadId: string;
  turnId: string;
  leaseOwner: string;
  staleAfterSeconds?: number;
}): Promise<GenerationRun> {
  const response = await putJson<GenerationRunRead>(`${SERVER_BASE_URL}/domain/generation-runs/${encodeURIComponent(run.runId)}`, {
    run_id: run.runId,
    session_id: run.sessionId,
    thread_id: run.threadId,
    turn_id: run.turnId,
    lease_owner: run.leaseOwner,
    status: 'active',
    stale_after_seconds: run.staleAfterSeconds,
  });

  return mapGenerationRun(response);
}

export async function heartbeatGenerationRun(
  runId: string,
  leaseOwner?: string,
): Promise<GenerationRun> {
  const response = await patchJson<GenerationRunRead>(`${SERVER_BASE_URL}/domain/generation-runs/${encodeURIComponent(runId)}/heartbeat`, {
    lease_owner: leaseOwner,
  });

  return mapGenerationRun(response);
}

export async function getActiveGenerationRuns(filters: {
  sessionId?: string;
  threadId?: string;
  turnId?: string;
} = {}): Promise<GenerationRun[]> {
  const params = new URLSearchParams();

  if (filters.sessionId) {
    params.set('session_id', filters.sessionId);
  }

  if (filters.threadId) {
    params.set('thread_id', filters.threadId);
  }

  if (filters.turnId) {
    params.set('turn_id', filters.turnId);
  }

  const query = params.size > 0 ? `?${params.toString()}` : '';
  const response = await getJson<GenerationRunRead[]>(`${SERVER_BASE_URL}/domain/generation-runs/active${query}`);
  return response.map(mapGenerationRun);
}

export async function getGenerationRunExecutionState(filters: {
  sessionId?: string;
  threadId?: string;
  turnId?: string;
  staleAfterSeconds?: number;
} = {}): Promise<GenerationRunExecutionState> {
  const params = new URLSearchParams();

  if (filters.sessionId) {
    params.set('session_id', filters.sessionId);
  }

  if (filters.threadId) {
    params.set('thread_id', filters.threadId);
  }

  if (filters.turnId) {
    params.set('turn_id', filters.turnId);
  }

  if (filters.staleAfterSeconds !== undefined) {
    params.set('stale_after_seconds', String(filters.staleAfterSeconds));
  }

  const query = params.size > 0 ? `?${params.toString()}` : '';
  const response = await getJson<GenerationRunExecutionStateRead>(`${SERVER_BASE_URL}/domain/generation-runs/execution-state${query}`);

  return {
    checkedAt: response.checked_at,
    staleAfterSeconds: response.stale_after_seconds,
    restoreCandidates: (response.restore_candidates ?? []).map(mapGenerationRunRestoreCandidate),
  };
}

export async function getGenerationRunProgress(
  runId: string,
  options: { afterSequence?: number; limit?: number } = {},
): Promise<GenerationRunProgressSnapshot | null> {
  const params = new URLSearchParams();

  if (options.afterSequence !== undefined) {
    params.set('after_sequence', String(options.afterSequence));
  }

  if (options.limit !== undefined) {
    params.set('limit', String(options.limit));
  }

  const query = params.size > 0 ? `?${params.toString()}` : '';

  try {
    const response = await getJson<GenerationRunProgressSnapshotRead>(
      `${SERVER_BASE_URL}/domain/generation-runs/${encodeURIComponent(runId)}/progress${query}`,
    );
    return mapGenerationRunProgressSnapshot(response);
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      return null;
    }

    throw error;
  }
}

export async function patchGenerationRunStatus(
  runId: string,
  status: GenerationRunStatus,
  error?: { code?: string; message?: string },
): Promise<GenerationRun> {
  const response = await patchJson<GenerationRunRead>(`${SERVER_BASE_URL}/domain/generation-runs/${encodeURIComponent(runId)}/status`, {
    status,
    error_code: error?.code,
    error_message: error?.message,
  });

  return mapGenerationRun(response);
}

export async function reconcileGenerationRuns(filters: {
  sessionId?: string;
  threadId?: string;
  turnId?: string;
  staleAfterSeconds?: number;
  error?: { code?: string; message?: string };
} = {}): Promise<GenerationRun[]> {
  const response = await postJson<GenerationRunRead[]>(`${SERVER_BASE_URL}/domain/generation-runs/reconcile`, {
    session_id: filters.sessionId,
    thread_id: filters.threadId,
    turn_id: filters.turnId,
    stale_after_seconds: filters.staleAfterSeconds ?? 0,
    error_code: filters.error?.code,
    error_message: filters.error?.message,
  });

  return response.map(mapGenerationRun);
}
