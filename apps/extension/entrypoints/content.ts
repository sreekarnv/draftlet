import { createFloatingButton } from '../components/floating-button';
import {
  ACTIVATE_INSERTION_TAB,
  CANCEL_DRAFT_GENERATION,
  CREATE_COMMAND_SURFACE_SESSION,
  GET_INSERTION_TARGET_STATUS,
  INSERT_REPLY,
  INSERTION_IN_PROGRESS,
  LAUNCH_SIDE_PANEL,
  RECAPTURE_INSERTION_TARGET,
  REVALIDATE_INSERTION_TARGET,
  START_DRAFT_GENERATION,
  type CreateCommandSurfaceSessionResult,
  type DraftletMessage,
  type DraftletSidePanelContext,
  type InsertionTargetStatusResult,
  type InsertReplyResult,
  type LaunchSidePanelResult,
  type RecaptureInsertionTargetFailureReason,
  type RecaptureInsertionTargetResult,
  type StartDraftGenerationResult,
} from '../core/messages';
import { createInsertionTargetStore, type InsertionTargetStore } from '../core/insertion-target-store';
import { logTargetEvent } from '../core/draftlet-log';
import { restoreTargetFromRef, type FocusSnapshot } from '../core/focus';
import { insertReply } from '../core/insertion';
import { getPageSelection, type PageSelection } from '../core/selection';
import { createCommandSurface } from '../ui/command-surface/command-surface';
import { isCommandSurfaceShortcut } from '../ui/command-surface/shortcut';

export default defineContentScript({
  matches: ['<all_urls>'],
  main(ctx) {
    const targetStore = createInsertionTargetStore();
    let activeSelection: PageSelection | null = null;

    const createCommandSession = async (context: DraftletSidePanelContext): Promise<CreateCommandSurfaceSessionResult> => {
      try {
        return await browser.runtime.sendMessage({
          type: CREATE_COMMAND_SURFACE_SESSION,
          context,
        } satisfies DraftletMessage) as CreateCommandSurfaceSessionResult;
      } catch (error) {
        return {
          created: false,
          error: {
            code: 'command_surface_session_failed',
            message: error instanceof Error ? error.message : 'Could not create a Draftlet session.',
            retryable: true,
          },
        };
      }
    };

    const launchSidePanel = async (): Promise<boolean> => {
      if (!activeSelection) {
        return false;
      }

      const storedTarget = targetStore.getLiveSnapshot();
      const context = createSidePanelContext(activeSelection.text, storedTarget);

      try {
        const response = await browser.runtime.sendMessage({
          type: LAUNCH_SIDE_PANEL,
          context,
        } satisfies DraftletMessage) as LaunchSidePanelResult;

        return response.opened;
      } catch {
        return false;
      }
    };

    const trigger = createFloatingButton({
      async onClick() {
        if (!activeSelection) {
          return;
        }

        targetStore.rememberTriggerCapture();

        if (await launchSidePanel()) {
          trigger.hide();
          return;
        }

        console.warn('Draftlet side panel could not be opened by the extension.');
      },
    });

    const commandSurface = createCommandSurface({
      async createSession(context) {
        const response = await createCommandSession(context);
        return {
          created: response.created,
          session: response.session,
          message: response.error?.message,
        };
      },
      async startGeneration(sessionId) {
        return await browser.runtime.sendMessage({
          type: START_DRAFT_GENERATION,
          sessionId,
        } satisfies DraftletMessage) as StartDraftGenerationResult;
      },
      async cancelGeneration(sessionId, generationId) {
        await browser.runtime.sendMessage({
          type: CANCEL_DRAFT_GENERATION,
          sessionId,
          generationId,
        } satisfies DraftletMessage).catch(() => undefined);
      },
      async getInsertionTargetStatus(sessionId) {
        return await browser.runtime.sendMessage({
          type: GET_INSERTION_TARGET_STATUS,
          sessionId,
        } satisfies DraftletMessage) as InsertionTargetStatusResult;
      },
      async insertDraft(sessionId, replyText) {
        const response = await browser.runtime.sendMessage({
          type: INSERT_REPLY,
          sessionId,
          replyText,
        } satisfies DraftletMessage) as InsertReplyResult;

        if (response.result.status !== 'failed') {
          return response.result;
        }

        try {
          await navigator.clipboard.writeText(replyText);
          return {
            status: 'copied',
            message: response.result.message || 'Draftlet could not insert, so it copied the draft.',
            targetStatus: response.result.targetStatus ?? 'unavailable',
            errorCode: response.result.errorCode,
          };
        } catch {
          return response.result;
        }
      },
      async openWorkshop(context) {
        try {
          const response = await browser.runtime.sendMessage({
            type: LAUNCH_SIDE_PANEL,
            context,
          } satisfies DraftletMessage) as LaunchSidePanelResult;
          return response.opened;
        } catch {
          return false;
        }
      },
    });

    const updateSelection = () => {
      activeSelection = getPageSelection();

      if (!activeSelection) {
        trigger.hide();
        return;
      }

      trigger.show(activeSelection.rect);
    };

    const dismiss = (event: PointerEvent) => {
      if (trigger.element.contains(event.target as Node)) {
        return;
      }

      if (!getPageSelection()) {
        activeSelection = null;
        trigger.hide();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      targetStore.notePointerDown(event.target);
      dismiss(event);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isCommandSurfaceShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();
        targetStore.noteFocusIn(event.target);
        const selection = getPageSelection(event.target);
        activeSelection = selection;
        commandSurface.open(createCommandSurfaceContext(selection?.text ?? '', targetStore.getLiveSnapshot()));
        trigger.hide();
        return;
      }

      targetStore.notePointerDown(event.target);
    };

    const resolveInsertionTarget = (targetRef?: FocusSnapshot['targetRef']): FocusSnapshot | null => {
      const live = targetStore.getLiveSnapshot();
      if (!targetRef) {
        return live;
      }

      if (live && live.targetRef?.fingerprint === targetRef.fingerprint) {
        return live;
      }

      return live;
    };

    const revalidateInsertionTarget = (targetRef?: FocusSnapshot['targetRef']): InsertionTargetStatusResult => {
      const live = resolveInsertionTarget(targetRef);

      if (live?.targetRef) {
        return { status: 'live', target: live.targetRef, message: 'Compose target is available.' };
      }

      if (targetRef) {
        return { status: 'stale', target: targetRef, message: 'The saved compose target is no longer available on this page.' };
      }

      return { status: 'needs_recapture', message: 'Focus a compose field before inserting.' };
    };

    // Track the currently arming insert so a second INSERT_REPLY can cancel
    // the prior one and resolve it with insert_superseded.
    let activeArmController: AbortController | null = null;
    const supersededResult: InsertReplyResult = {
      result: {
        status: 'failed',
        message: '',
        targetStatus: 'unavailable',
        errorCode: 'insert_superseded',
      },
    };

    const cancelActiveArm = () => {
      if (activeArmController) {
        activeArmController.abort();
        activeArmController = null;
      }
      targetStore.cancelArm();
    };

    const handleInsertReply = async (
      sessionId: string,
      replyText: string,
      targetRef?: FocusSnapshot['targetRef'],
    ): Promise<InsertReplyResult> => {
      // A new insert supersedes any prior arming insert. Resolve the prior
      // promise silently (no copy attempt, no trail item) and start fresh.
      if (activeArmController) {
        cancelActiveArm();
      }

      const live = targetStore.getLiveSnapshot();

      if (live) {
        logTargetEvent('inserting into cached target', {
          kind: live.targetRef?.kind ?? 'unknown',
        });
        return insertReply(replyText, live).then((result) => ({ result }));
      }

      const restored = targetRef ? restoreTargetFromRef(targetRef) : null;
      if (restored) {
        targetStore.noteFocusIn(restored.element);
        logTargetEvent('inserting into cached target', {
          kind: restored.targetRef?.kind ?? 'unknown',
          reason: 'restored-ref',
        });
        return insertReply(replyText, restored).then((result) => ({ result }));
      }

      logTargetEvent('unavailable', { reason: 'no-target' });

      // Step 1 (listener first): install the arm listener synchronously so
      // it is live before the side panel is told anything about the pending
      // state and before the original tab is brought forward.
      const armController = new AbortController();
      activeArmController = armController;
      const armPromise = targetStore.armCaptureForNextEditable({
        timeoutMs: 10000,
        document,
      });

      // Step 2: fire-and-forget pending UI broadcast.
      void browser.runtime.sendMessage({
        type: INSERTION_IN_PROGRESS,
        sessionId,
        message: 'Click the compose field to insert.',
      } satisfies DraftletMessage).catch(() => undefined);

      // Step 3: fire-and-forget request to activate the original tab/window.
      void browser.runtime.sendMessage({
        type: ACTIVATE_INSERTION_TAB,
        sessionId,
      } satisfies DraftletMessage).catch(() => undefined);

      // Step 4: await the arm. Resolve supersede if a new insert arrived
      // while we were waiting.
      let armed: FocusSnapshot | null;
      try {
        const armSignal = armController.signal;
        const settled = await new Promise<FocusSnapshot | null>((resolve) => {
          let settled = false;
          const onAbort = () => {
            if (settled) return;
            settled = true;
            resolve(null);
          };
          if (armSignal.aborted) {
            onAbort();
            return;
          }
          armSignal.addEventListener('abort', onAbort, { once: true });
          armPromise.then((value) => {
            if (settled) return;
            settled = true;
            armSignal.removeEventListener('abort', onAbort);
            resolve(value);
          }).catch(() => {
            if (settled) return;
            settled = true;
            armSignal.removeEventListener('abort', onAbort);
            resolve(null);
          });
        });
        armed = settled;
      } catch {
        armed = null;
      }

      if (armController.signal.aborted && activeArmController !== armController) {
        return supersededResult;
      }

      if (activeArmController === armController) {
        activeArmController = null;
      }

      if (armed) {
        logTargetEvent('inserting into cached target', {
          kind: armed.targetRef?.kind ?? 'unknown',
        });
        return insertReply(replyText, armed).then((result) => ({ result }));
      }

      logTargetEvent('unavailable', { reason: 'armed_capture_timeout' });
      return {
        result: {
          status: 'failed',
          message: '',
          targetStatus: 'unavailable',
          errorCode: 'armed_capture_timeout',
        },
      };
    };

    const recaptureInsertionTarget = async (
      sessionId: string,
      targetRef?: FocusSnapshot['targetRef'],
    ): Promise<RecaptureInsertionTargetResult> => {
      // Step 1: cached live snapshot. This never reads document.activeElement.
      const live = targetStore.getLiveSnapshot();
      if (live?.targetRef) {
        logTargetEvent('recapture status', { valid: true, reason: 'cached' });
        return {
          recaptured: true,
          status: 'live',
          outcome: 'recapture_succeeded',
          target: live.targetRef,
          message: 'Target rebound successfully.',
        };
      }

      // Step 2: rebound via the saved targetRef (selector + fingerprint).
      if (targetRef) {
        const restored = targetRef ? restoreTargetFromRef(targetRef) : null;
        if (restored) {
          targetStore.noteFocusIn(restored.element);
          const rebound = targetStore.getLiveSnapshot();
          if (rebound?.targetRef) {
            logTargetEvent('recapture status', { valid: true, reason: 'rebounded' });
            return {
              recaptured: true,
              status: 'live',
              outcome: 'recapture_succeeded',
              target: rebound.targetRef,
              message: 'Target rebound successfully.',
            };
          }
        }
      }

      // Step 3: install the arm listener BEFORE asking the background to activate
      // the original tab. This ordering matters: the listener is live before the
      // user can interact with the page.
      const armPromise = targetStore.armCaptureForNextEditable();
      logTargetEvent('recapture status', { valid: false, reason: 'armed_capture_pending' });

      // Step 4: fire-and-forget request to activate the original tab/window.
      void browser.runtime.sendMessage({
        type: ACTIVATE_INSERTION_TAB,
        sessionId,
      } satisfies DraftletMessage).catch(() => undefined);

      // Step 5: await the arm. The promise resolves with the captured snapshot
      // or null on timeout. The runtime awaits the listener's return value, so
      // the background's tabs.sendMessage resolves only after this returns.
      const armed = await armPromise;

      if (armed?.targetRef) {
        logTargetEvent('recapture status', { valid: true, reason: 'armed' });
        return {
          recaptured: true,
          status: 'live',
          outcome: 'recapture_succeeded',
          target: armed.targetRef,
          message: 'Target rebound successfully.',
        };
      }

      logTargetEvent('unavailable', { reason: 'armed_capture_timeout' });
      return {
        recaptured: false,
        status: 'unavailable',
        outcome: 'recapture_failed',
        reason: 'armed_capture_timeout' satisfies RecaptureInsertionTargetFailureReason,
        message: 'Could not capture a compose field.',
      };
    };

    const handleRuntimeMessage = (
      message: DraftletMessage,
    ): Promise<InsertReplyResult | InsertionTargetStatusResult | RecaptureInsertionTargetResult> | undefined => {
      commandSurface.handleMessage(message);

      if (message.type === REVALIDATE_INSERTION_TARGET) {
        return Promise.resolve(revalidateInsertionTarget(message.target));
      }

      if (message.type === RECAPTURE_INSERTION_TARGET) {
        return recaptureInsertionTarget(message.sessionId, message.target);
      }

      if (message.type === INSERT_REPLY) {
        return handleInsertReply(message.sessionId ?? '', message.replyText, message.target);
      }

      return undefined;
    };

    browser.runtime.onMessage.addListener(handleRuntimeMessage);

    document.addEventListener('focusin', (event) => targetStore.noteFocusIn(event.target), true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('input', (event) => targetStore.noteInput(event.target), true);
    document.addEventListener('selectionchange', () => {
      targetStore.noteSelectionChange();
      updateSelection();
    });
    document.addEventListener('keyup', updateSelection);
    document.addEventListener('mouseup', updateSelection);

    ctx.onInvalidated(() => {
      browser.runtime.onMessage.removeListener(handleRuntimeMessage);
      targetStore.cancelArm();
      document.removeEventListener('keydown', onKeyDown, true);
      trigger.remove();
      commandSurface.remove();
    });
  },
});

function createSidePanelContext(selectedText: string, target: FocusSnapshot | null): DraftletSidePanelContext {
  return {
    selectedText,
    sourceUrl: window.location.href,
    sourceDomain: window.location.hostname || undefined,
    pageTitle: document.title || undefined,
    composeTarget: target?.targetRef,
  };
}

function createCommandSurfaceContext(selectedText: string, target: FocusSnapshot | null): DraftletSidePanelContext {
  return createSidePanelContext(selectedText, target);
}

export type { InsertionTargetStore };
