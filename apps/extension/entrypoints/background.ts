import { checkServerHealth, streamReplies } from '../core/api';
import { DEFAULT_TONE } from '../core/constants';
import {
  CANCEL_DRAFT_GENERATION,
  DRAFT_GENERATION_COMPLETED,
  DRAFT_GENERATION_FAILED,
  DRAFT_GENERATION_STARTED,
  DRAFT_REPLY_RECEIVED,
  GET_RUNTIME_STATUS,
  GET_SIDE_PANEL_CONTEXT,
  INSERT_REPLY,
  LAUNCH_SIDE_PANEL,
  SIDE_PANEL_CONTEXT_UPDATED,
  START_DRAFT_GENERATION,
  type CancelDraftGenerationResult,
  type DraftletError,
  type DraftletMessage,
  type DraftletSidePanelContext,
  type InsertReplyResult,
  type LaunchSidePanelResult,
  type RuntimeStatusResult,
  type SidePanelContextResult,
  type StartDraftGenerationResult,
} from '../core/messages';

interface ActiveGeneration {
  generationId: string;
  controller: AbortController;
}

let latestContext: DraftletSidePanelContext | null = null;
let activeGeneration: ActiveGeneration | null = null;

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: DraftletMessage, sender) => {
    if (message.type === LAUNCH_SIDE_PANEL) {
      return handleLaunchSidePanel(message.context, sender);
    }

    if (message.type === GET_SIDE_PANEL_CONTEXT) {
      return Promise.resolve({ context: latestContext } satisfies SidePanelContextResult);
    }

    if (message.type === GET_RUNTIME_STATUS) {
      return handleGetRuntimeStatus();
    }

    if (message.type === START_DRAFT_GENERATION) {
      return Promise.resolve(handleStartDraftGeneration(message.context));
    }

    if (message.type === CANCEL_DRAFT_GENERATION) {
      return Promise.resolve(handleCancelDraftGeneration(message.generationId));
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
    void emitDraftletMessage({
      type: SIDE_PANEL_CONTEXT_UPDATED,
      context: latestContext,
    });

    return { opened: true };
  } catch (error) {
    return {
      opened: false,
      message: error instanceof Error ? error.message : 'Could not open side panel.',
    };
  }
}

async function handleGetRuntimeStatus(): Promise<RuntimeStatusResult> {
  const connected = await checkServerHealth();
  return { status: connected ? 'connected' : 'disconnected' };
}

function handleStartDraftGeneration(context: DraftletSidePanelContext): StartDraftGenerationResult {
  const selectedText = context.selectedText.trim();

  if (!selectedText) {
    return {
      started: false,
      error: createDraftletError('missing_context', 'Select text on a page before generating replies.', true),
    };
  }

  handleCancelDraftGeneration();

  const generationId = createGenerationId();
  const controller = new AbortController();
  activeGeneration = { generationId, controller };

  void runDraftGeneration(
    {
      ...context,
      selectedText,
      tone: context.tone ?? DEFAULT_TONE,
    },
    generationId,
    controller,
  );

  return { started: true, generationId };
}

function handleCancelDraftGeneration(generationId?: string): CancelDraftGenerationResult {
  if (!activeGeneration) {
    return { canceled: false };
  }

  if (generationId && activeGeneration.generationId !== generationId) {
    return { canceled: false };
  }

  activeGeneration.controller.abort();
  activeGeneration = null;
  return { canceled: true };
}

async function runDraftGeneration(
  context: DraftletSidePanelContext,
  generationId: string,
  controller: AbortController,
): Promise<void> {
  let replyCount = 0;

  await Promise.resolve();

  if (!isActiveGeneration(generationId)) {
    return;
  }

  await emitDraftletMessage({
    type: DRAFT_GENERATION_STARTED,
    generationId,
  });

  try {
    const connected = await checkServerHealth(controller.signal);

    if (!connected) {
      await emitGenerationFailed(
        generationId,
        createDraftletError('runtime_unavailable', 'Draftlet server is not reachable.', true, generationId),
      );
      return;
    }

    await streamReplies(
      {
        selected_text: context.selectedText,
        tone: context.tone ?? DEFAULT_TONE,
        source_url: context.sourceUrl,
        source_domain: context.sourceDomain,
      },
      {
        signal: controller.signal,
        onReply(reply) {
          if (!isActiveGeneration(generationId)) {
            return;
          }

          replyCount += 1;
          void emitDraftletMessage({
            type: DRAFT_REPLY_RECEIVED,
            generationId,
            reply,
          });
        },
      },
    );

    if (!isActiveGeneration(generationId)) {
      return;
    }

    await emitDraftletMessage({
      type: DRAFT_GENERATION_COMPLETED,
      generationId,
      replyCount,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }

    await emitGenerationFailed(
      generationId,
      createDraftletError(
        'generation_failed',
        error instanceof Error ? error.message : 'Could not stream replies from the local server.',
        true,
        generationId,
      ),
    );
  } finally {
    if (isActiveGeneration(generationId)) {
      activeGeneration = null;
    }
  }
}

async function emitGenerationFailed(generationId: string, error: DraftletError): Promise<void> {
  if (!isActiveGeneration(generationId)) {
    return;
  }

  await emitDraftletMessage({
    type: DRAFT_GENERATION_FAILED,
    generationId,
    error,
  });
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

function isActiveGeneration(generationId: string): boolean {
  return activeGeneration?.generationId === generationId;
}

function emitDraftletMessage(message: DraftletMessage): Promise<unknown> {
  return browser.runtime.sendMessage(message).catch(() => {});
}

function createDraftletError(
  code: string,
  message: string,
  retryable: boolean,
  correlationId?: string,
): DraftletError {
  return {
    code,
    message,
    retryable,
    correlationId,
  };
}

function createGenerationId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `generation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
