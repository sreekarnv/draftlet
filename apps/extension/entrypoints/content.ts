import { createFloatingButton } from '../components/floating-button';
import {
  INSERT_REPLY,
  LAUNCH_SIDE_PANEL,
  REVALIDATE_INSERTION_TARGET,
  type DraftletMessage,
  type DraftletSidePanelContext,
  type InsertionTargetStatusResult,
  type InsertReplyResult,
  type LaunchSidePanelResult,
} from '../core/messages';
import { captureFocusedTarget, isTargetRefLive, restoreTargetFromRef, type FocusSnapshot } from '../core/focus';
import { insertReply } from '../core/insertion';
import { getPageSelection, type PageSelection } from '../core/selection';

export default defineContentScript({
  matches: ['<all_urls>'],
  main(ctx) {
    let activeSelection: PageSelection | null = null;
    let insertionTarget: FocusSnapshot | null = null;

    const launchSidePanel = async (): Promise<boolean> => {
      if (!activeSelection) {
        return false;
      }

      const context = createSidePanelContext(activeSelection.text, insertionTarget);

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

        insertionTarget = captureFocusedTarget() ?? insertionTarget;

        if (await launchSidePanel()) {
          trigger.hide();
          return;
        }

        console.warn('Draftlet side panel could not be opened by the extension.');
      },
    });

    const updateInsertionTarget = (event: FocusEvent) => {
      if (trigger.element.contains(event.target as Node)) {
        return;
      }

      insertionTarget = captureFocusedTarget(event.target);
    };

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

    const resolveInsertionTarget = (targetRef = insertionTarget?.targetRef): FocusSnapshot | null => {
      if (!targetRef) {
        return insertionTarget;
      }

      if (isTargetRefLive(targetRef, insertionTarget)) {
        return insertionTarget;
      }

      const restored = restoreTargetFromRef(targetRef);

      if (restored) {
        insertionTarget = restored;
        return restored;
      }

      return null;
    };

    const revalidateInsertionTarget = (targetRef = insertionTarget?.targetRef): InsertionTargetStatusResult => {
      if (!targetRef) {
        const captured = captureFocusedTarget();
        insertionTarget = captured ?? insertionTarget;

        if (captured?.targetRef) {
          return { status: 'live', target: captured.targetRef, message: 'Active compose target is available.' };
        }

        return { status: 'needs_recapture', message: 'Focus a compose field before inserting.' };
      }

      const target = resolveInsertionTarget(targetRef);

      if (!target?.targetRef) {
        return { status: 'stale', target: targetRef, message: 'The saved compose target is no longer available on this page.' };
      }

      return { status: 'live', target: target.targetRef, message: 'Compose target is available.' };
    };

    const handleRuntimeMessage = (message: DraftletMessage): Promise<InsertReplyResult | InsertionTargetStatusResult> | undefined => {
      if (message.type === REVALIDATE_INSERTION_TARGET) {
        return Promise.resolve(revalidateInsertionTarget(message.target));
      }

      if (message.type === INSERT_REPLY) {
        const target = resolveInsertionTarget(message.target);
        return insertReply(message.replyText, target).then((result) => {
          insertionTarget = target?.element.isConnected ? target : insertionTarget;
          return { result };
        });
      }

      return undefined;
    };

    browser.runtime.onMessage.addListener(handleRuntimeMessage);

    document.addEventListener('focusin', updateInsertionTarget, true);
    document.addEventListener('selectionchange', updateSelection);
    document.addEventListener('keyup', updateSelection);
    document.addEventListener('mouseup', updateSelection);
    document.addEventListener('pointerdown', dismiss, true);

    ctx.onInvalidated(() => {
      document.removeEventListener('focusin', updateInsertionTarget, true);
      document.removeEventListener('selectionchange', updateSelection);
      document.removeEventListener('keyup', updateSelection);
      document.removeEventListener('mouseup', updateSelection);
      document.removeEventListener('pointerdown', dismiss, true);
      browser.runtime.onMessage.removeListener(handleRuntimeMessage);
      trigger.remove();
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
