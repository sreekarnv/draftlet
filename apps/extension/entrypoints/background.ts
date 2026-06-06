import {
  GET_SIDE_PANEL_CONTEXT,
  INSERT_REPLY,
  LAUNCH_SIDE_PANEL,
  SIDE_PANEL_CONTEXT_UPDATED,
  type DraftletMessage,
  type DraftletSidePanelContext,
  type InsertReplyResult,
  type LaunchSidePanelResult,
  type SidePanelContextResult,
} from '../core/messages';

let latestContext: DraftletSidePanelContext | null = null;

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: DraftletMessage, sender) => {
    if (message.type === LAUNCH_SIDE_PANEL) {
      return handleLaunchSidePanel(message.context, sender);
    }

    if (message.type === GET_SIDE_PANEL_CONTEXT) {
      return Promise.resolve({ context: latestContext } satisfies SidePanelContextResult);
    }

    if (message.type === INSERT_REPLY) {
      return handleInsertReply(message.replyText);
    }

    return undefined;
  });
});

async function handleLaunchSidePanel(
  context: DraftletSidePanelContext,
  sender: Browser.runtime.MessageSender,
): Promise<LaunchSidePanelResult> {
  latestContext = {
    ...context,
    tabId: sender.tab?.id ?? context.tabId,
    windowId: sender.tab?.windowId ?? context.windowId,
  };

  try {
    await openSidePanel(latestContext);
    void browser.runtime.sendMessage({
      type: SIDE_PANEL_CONTEXT_UPDATED,
      context: latestContext,
    } satisfies DraftletMessage).catch(() => {});

    return { opened: true };
  } catch (error) {
    return {
      opened: false,
      message: error instanceof Error ? error.message : 'Could not open side panel.',
    };
  }
}

async function handleInsertReply(replyText: string): Promise<InsertReplyResult> {
  if (!latestContext?.tabId) {
    return { result: { status: 'failed', message: 'No active Draftlet tab.' } };
  }

  return browser.tabs.sendMessage(latestContext.tabId, {
    type: INSERT_REPLY,
    replyText,
  } satisfies DraftletMessage) as Promise<InsertReplyResult>;
}

async function openSidePanel(context: DraftletSidePanelContext) {
  if (!browser.sidePanel?.open) {
    throw new Error('Chrome side panel is not available.');
  }

  if (typeof context.tabId === 'number') {
    await browser.sidePanel.open({ tabId: context.tabId });
    return;
  }

  if (typeof context.windowId === 'number') {
    await browser.sidePanel.open({ windowId: context.windowId });
    return;
  }

  throw new Error('No active tab or window for side panel.');
}
