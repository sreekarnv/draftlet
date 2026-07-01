import {
  ACCEPT_DRAFT_VARIANT,
  ACTIVATE_INSERTION_TAB,
  ACTIVATE_RECAPTURE_TAB,
  CANCEL_DRAFT_GENERATION,
  CREATE_COMMAND_SURFACE_SESSION,
  GET_CURRENT_WORKSPACE_SESSION,
  GET_DOMAIN_HISTORY,
  GET_INSERTION_TARGET_STATUS,
  GET_RECAPTURE_DIAGNOSTICS,
  GET_RUNTIME_STATUS,
  INSERT_REPLY,
  INSERTION_IN_PROGRESS,
  LAUNCH_SIDE_PANEL,
  PUBLISH_RECAPTURE_DIAGNOSTICS_REPORT,
  RECAPTURE_INSERTION_TARGET,
  RESTORE_DOMAIN_THREAD,
  SET_CURRENT_DRAFT_VARIANT,
  START_DRAFT_GENERATION,
  START_DRAFT_REFINEMENT,
  type DraftletMessage,
} from '../messages';
import {
  handleActivateInsertionTab,
  handleActivateRecaptureTab,
  handleGetInsertionTargetStatus,
  handleInsertionInProgress,
  handleInsertReply,
  handleRecaptureInsertionTarget,
} from './insertion';
import {
  handleCancelDraftGeneration,
  handleDraftVariantState,
  handleStartDraftGeneration,
} from './generation-coordinator';
import {
  handleGetDomainHistory,
  handleGetCurrentWorkspaceSession,
  handleCreateCommandSurfaceSession,
  handleLaunchSidePanel,
  handleRestoreDomainThread,
} from './workspace-session-coordinator';
import {
  handleGetRecaptureDiagnostics,
  handlePublishRecaptureDiagnosticsReport,
} from './diagnostics-coordinator';
import { handleGetRuntimeStatus } from './runtime-status-coordinator';

export function registerMessageRouter(
  events: { addListener: (fn: (message: DraftletMessage, sender: Browser.runtime.MessageSender) => unknown) => void },
): void {
  events.addListener((message, sender) => {
    if (message.type === LAUNCH_SIDE_PANEL) {
      return handleLaunchSidePanel(message.context, sender);
    }

    if (message.type === CREATE_COMMAND_SURFACE_SESSION) {
      return handleCreateCommandSurfaceSession(message.context, sender);
    }

    if (message.type === GET_CURRENT_WORKSPACE_SESSION) {
      return handleGetCurrentWorkspaceSession(message.tabId);
    }

    if (message.type === GET_RUNTIME_STATUS) {
      return handleGetRuntimeStatus();
    }

    if (message.type === GET_DOMAIN_HISTORY) {
      return handleGetDomainHistory(message.limit);
    }

    if (message.type === GET_RECAPTURE_DIAGNOSTICS) {
      return handleGetRecaptureDiagnostics(message.sessionId, message.limit);
    }

    if (message.type === PUBLISH_RECAPTURE_DIAGNOSTICS_REPORT) {
      return handlePublishRecaptureDiagnosticsReport(message.sessionId, message.limit);
    }

    if (message.type === RESTORE_DOMAIN_THREAD) {
      return handleRestoreDomainThread(message.sessionId, message.threadId);
    }

    if (message.type === START_DRAFT_GENERATION) {
      return Promise.resolve(handleStartDraftGeneration(message.sessionId, {
        tone: message.tone,
        replySurface: message.replySurface,
        replyStyle: message.replyStyle,
        activeView: message.activeView,
      }));
    }

    if (message.type === START_DRAFT_REFINEMENT) {
      return Promise.resolve(handleStartDraftGeneration(message.sessionId, {
        tone: message.tone,
        replySurface: message.replySurface,
        replyStyle: message.replyStyle,
        activeView: message.activeView,
        instruction: message.instruction,
        mode: 'refinement',
      }));
    }

    if (message.type === CANCEL_DRAFT_GENERATION) {
      return handleCancelDraftGeneration(message.sessionId, message.generationId);
    }

    if (message.type === INSERT_REPLY) {
      return handleInsertReply(message.replyText, message.sessionId);
    }

    if (message.type === GET_INSERTION_TARGET_STATUS) {
      return handleGetInsertionTargetStatus(message.sessionId);
    }

    if (message.type === RECAPTURE_INSERTION_TARGET) {
      return handleRecaptureInsertionTarget(message.sessionId, message.tabId);
    }

    if (message.type === ACTIVATE_RECAPTURE_TAB) {
      return handleActivateRecaptureTab(message.sessionId, message.tabId);
    }

    if (message.type === ACTIVATE_INSERTION_TAB) {
      return handleActivateInsertionTab(message.sessionId);
    }

    if (message.type === INSERTION_IN_PROGRESS) {
      return handleInsertionInProgress(message.sessionId, message.message);
    }

    if (message.type === SET_CURRENT_DRAFT_VARIANT) {
      return Promise.resolve(handleDraftVariantState(message.sessionId, message.variantId, { isCurrent: true }));
    }

    if (message.type === ACCEPT_DRAFT_VARIANT) {
      return Promise.resolve(handleDraftVariantState(message.sessionId, message.variantId, { status: 'accepted' }));
    }

    return undefined;
  });
}
