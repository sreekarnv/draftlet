import { createWorkspaceSessionStore, type WorkspaceSessionStore } from '../workspace-session';
import { createConversationThreadStore, type ConversationThreadStore } from '../conversation-thread';
import {
  createRecaptureDiagnosticsLog,
  type RecaptureDiagnosticsLog,
} from '../recapture-diagnostics';
import {
  createRecaptureDiagnosticsPublishRetryQueue,
  type RecaptureDiagnosticsPublishRetryQueue,
} from '../recapture-diagnostics-publish-retry';
import type { PlausibleTabCandidate } from '../tab-disambiguation';

export interface LocalGenerationTransportHandle {
  sessionId: string;
  abortController: AbortController;
}

export type InsertionTabResolution =
  | { status: 'resolved'; tab: Browser.tabs.Tab }
  | { status: 'ambiguous'; candidates: PlausibleTabCandidate[] }
  | { status: 'missing' };

export const GENERATION_RUN_STALE_AFTER_SECONDS = 30;

// Browser-local fetch/SSE handles only. Runtime GenerationRun state and durable replay remain the recovery source.

export const sessions: WorkspaceSessionStore = createWorkspaceSessionStore();
export const threads: ConversationThreadStore = createConversationThreadStore();
export const recaptureDiagnostics: RecaptureDiagnosticsLog = createRecaptureDiagnosticsLog();
export const recaptureDiagnosticsPublishRetry: RecaptureDiagnosticsPublishRetryQueue = createRecaptureDiagnosticsPublishRetryQueue();
export const restoreDiagnosticKeyBySessionId = new Map<string, string>();
export const localGenerationTransportByRunId = new Map<string, LocalGenerationTransportHandle>();

export const publishRetryInFlight = { value: false };
