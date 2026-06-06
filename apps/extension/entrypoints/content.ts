import { createFloatingButton } from '../components/floating-button';
import { createReplyPanel } from '../components/reply-panel';
import { checkServerHealth, streamReplies } from '../core/api';
import { INSERT_REPLY, LAUNCH_SIDE_PANEL, type DraftletMessage, type DraftletSidePanelContext, type InsertReplyResult, type LaunchSidePanelResult } from '../core/messages';
import { captureFocusedTarget, type FocusSnapshot } from '../core/focus';
import { insertReply } from '../core/insertion';
import { DEFAULT_PANEL_VIEW, DEFAULT_TONE } from '../core/constants';
import { getPageSelection, type PageSelection } from '../core/selection';
import { getSavedPanelView, getSavedTone, savePanelView, saveTone } from '../core/storage';
import type { PanelView, Tone } from '../core/types';

export default defineContentScript({
  matches: ['<all_urls>'],
  main(ctx) {
    let activeSelection: PageSelection | null = null;
    let panelSelectionText = '';
    let currentTone: Tone = DEFAULT_TONE;
    let currentPanelView: PanelView = DEFAULT_PANEL_VIEW;
    let insertionTarget: FocusSnapshot | null = null;
    let activeRequest: AbortController | null = null;

    const abortActiveRequest = () => {
      activeRequest?.abort();
      activeRequest = null;
    };

    const refreshHealth = async () => {
      const connected = await checkServerHealth();
      panel.setConnectionStatus(connected ? 'connected' : 'disconnected');
      return connected;
    };

    const launchSidePanel = async (): Promise<boolean> => {
      if (!activeSelection) {
        return false;
      }

      const context = createSidePanelContext(activeSelection.text, currentTone, currentPanelView);

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

    const generateReplies = async () => {
      if (!panelSelectionText) {
        panel.setState('error', 'Select text before generating replies.');
        return;
      }

      abortActiveRequest();
      activeRequest = new AbortController();
      let replyCount = 0;

      panel.clearReplies();
      panel.setState('loading');

      try {
        const connected = await refreshHealth();

        if (!connected) {
          panel.setState('error', 'Draftlet server is not reachable.');
          return;
        }

        await streamReplies(
          {
            selected_text: panelSelectionText,
            tone: currentTone,
            ...getSourceContext(),
          },
          {
            signal: activeRequest.signal,
            onReply(reply) {
              replyCount += 1;
              panel.addReply(reply);
            },
          },
        );

        panel.setState(replyCount > 0 ? 'success' : 'error', 'No replies returned.');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        panel.setConnectionStatus('disconnected');
        panel.setState(
          'error',
          error instanceof Error ? error.message : 'Could not stream replies from the local server.',
        );
      } finally {
        activeRequest = null;
      }
    };

    const panel = createReplyPanel({
      initialTone: currentTone,
      initialView: currentPanelView,
      onToneChange(tone) {
        currentTone = tone;
        void saveTone(tone);
      },
      onViewChange(activeView) {
        currentPanelView = activeView;
        void savePanelView(activeView);
      },
      onGenerate() {
        void generateReplies();
      },
      onInsert(replyText) {
        return insertReply(replyText, insertionTarget);
      },
      onClose() {
        abortActiveRequest();
      },
    });

    const trigger = createFloatingButton({
      async onClick() {
        if (!activeSelection) {
          return;
        }

        insertionTarget = captureFocusedTarget() ?? insertionTarget;
        panelSelectionText = activeSelection.text;

        if (await launchSidePanel()) {
          trigger.hide();
          return;
        }

        panel.open(activeSelection.rect, {
          selectedText: panelSelectionText,
          tone: currentTone,
          activeView: currentPanelView,
        });
        void refreshHealth();
      },
    });

    void Promise.all([getSavedTone(), getSavedPanelView()]).then(([tone, panelView]) => {
      currentTone = tone;
      currentPanelView = panelView;
      panel.setTone(tone);
      panel.setActiveView(panelView);
    });

    const updateInsertionTarget = (event: FocusEvent) => {
      if (panel.contains(event.target) || trigger.element.contains(event.target as Node)) {
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
      const target = event.target;

      if (trigger.element.contains(target as Node) || panel.contains(target)) {
        return;
      }

      panel.close();

      if (!getPageSelection()) {
        activeSelection = null;
        trigger.hide();
      }
    };

    const handleRuntimeMessage = (message: DraftletMessage): Promise<InsertReplyResult> | undefined => {
      if (message.type !== INSERT_REPLY) {
        return undefined;
      }

      return insertReply(message.replyText, insertionTarget).then((result) => ({ result }));
    };

    browser.runtime.onMessage.addListener(handleRuntimeMessage);

    document.addEventListener('focusin', updateInsertionTarget, true);
    document.addEventListener('selectionchange', updateSelection);
    document.addEventListener('keyup', updateSelection);
    document.addEventListener('mouseup', updateSelection);
    document.addEventListener('pointerdown', dismiss, true);

    ctx.onInvalidated(() => {
      abortActiveRequest();
      document.removeEventListener('focusin', updateInsertionTarget, true);
      document.removeEventListener('selectionchange', updateSelection);
      document.removeEventListener('keyup', updateSelection);
      document.removeEventListener('mouseup', updateSelection);
      document.removeEventListener('pointerdown', dismiss, true);
      browser.runtime.onMessage.removeListener(handleRuntimeMessage);
      trigger.remove();
      panel.remove();
    });
  },
});
function createSidePanelContext(selectedText: string, tone: Tone, activeView: PanelView): DraftletSidePanelContext {
  return {
    selectedText,
    tone,
    activeView,
    sourceUrl: window.location.href,
    sourceDomain: window.location.hostname || undefined,
  };
}

function getSourceContext() {
  return {
    source_url: window.location.href,
    source_domain: window.location.hostname || undefined,
  };
}

