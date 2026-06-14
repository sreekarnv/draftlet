export const GENERATION_RUN_MAINTENANCE_DIAGNOSTICS_PROTOCOL = 'draftlet.generation-run-maintenance-diagnostics.v1';

export interface GenerationRunMaintenanceOutcome {
  id: number;
  operation: string;
  status: string;
  source?: string | null;
  at: string;
  reconciledRunCount: number;
  reconciledRunIds: string[];
  prunedEventCount: number;
  staleAfterSeconds?: number | null;
  retentionDays?: number | null;
  replayLimit?: number | null;
  pruneBatchSize?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface GenerationRunMaintenanceStatus {
  checkedAt: string;
  processLocal: boolean;
  recentLimit: number;
  retentionDays: number;
  maxStoredOutcomes: number;
  latestStartup?: GenerationRunMaintenanceOutcome | null;
  latestStaleReconciliation?: GenerationRunMaintenanceOutcome | null;
  latestReplayPrune?: GenerationRunMaintenanceOutcome | null;
  recent: GenerationRunMaintenanceOutcome[];
}

export interface GenerationRunMaintenanceDiagnosticsSuccess {
  ok: true;
  protocol: typeof GENERATION_RUN_MAINTENANCE_DIAGNOSTICS_PROTOCOL;
  status: GenerationRunMaintenanceStatus;
}

export interface GenerationRunMaintenanceDiagnosticsFailure {
  ok: false;
  error: {
    code: 'transport_unavailable' | 'diagnostics_unavailable';
    message: string;
    retryable: boolean;
  };
}

export type GenerationRunMaintenanceDiagnosticsResult =
  | GenerationRunMaintenanceDiagnosticsSuccess
  | GenerationRunMaintenanceDiagnosticsFailure;

export function createGenerationRunMaintenanceDiagnosticsFailure(
  code: GenerationRunMaintenanceDiagnosticsFailure['error']['code'],
  message: string,
  retryable = true,
): GenerationRunMaintenanceDiagnosticsFailure {
  return {
    ok: false,
    error: {
      code,
      message,
      retryable,
    },
  };
}
