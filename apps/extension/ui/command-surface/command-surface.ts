import {
  appendSentenceBufferChunk,
  createSentenceBufferState,
  flushSentenceBuffer,
  sentenceBufferText,
  type SentenceBufferState,
} from '../../components/panel/sentence-buffer';
import type {
  ConversationThreadSnapshot,
  DraftletMessage,
  DraftletSidePanelContext,
  InsertionResult,
  InsertionTargetStatusResult,
  StartDraftGenerationResult,
  WorkspaceSession,
} from '../../core/messages';

type CommandSurfaceStatus = 'idle' | 'starting' | 'streaming' | 'cancelled' | 'inserted' | 'copied' | 'error';

export interface CommandSurfaceCallbacks {
  createSession(context: DraftletSidePanelContext): Promise<{ created: boolean; session?: WorkspaceSession; message?: string }>;
  startGeneration(sessionId: string): Promise<StartDraftGenerationResult>;
  cancelGeneration(sessionId?: string, generationId?: string): Promise<void>;
  getInsertionTargetStatus(sessionId: string): Promise<InsertionTargetStatusResult>;
  insertDraft(sessionId: string, text: string): Promise<InsertionResult>;
  openWorkshop(context: DraftletSidePanelContext): Promise<boolean>;
}

export interface CommandSurfaceController {
  open(context: DraftletSidePanelContext): void;
  handleMessage(message: DraftletMessage): void;
  close(): void;
  remove(): void;
  isOpen(): boolean;
}

interface CommandSurfaceState {
  context: DraftletSidePanelContext | null;
  sessionId?: string;
  generationId?: string;
  threadId?: string;
  turnId?: string;
  status: CommandSurfaceStatus;
  statusMessage: string;
  sentenceBuffer: SentenceBufferState;
  userEdited: boolean;
}

export function createCommandSurface(callbacks: CommandSurfaceCallbacks): CommandSurfaceController {
  const host = document.createElement('draftlet-command-surface');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  const root = document.createElement('section');
  const title = document.createElement('h2');
  const contextText = document.createElement('p');
  const statusText = document.createElement('p');
  const editor = document.createElement('textarea');
  const actions = document.createElement('div');
  const generateButton = document.createElement('button');
  const insertButton = document.createElement('button');
  const copyButton = document.createElement('button');
  const cancelButton = document.createElement('button');
  const workshopButton = document.createElement('button');
  const closeButton = document.createElement('button');

  let state = initialState();
  let restoreFocusTarget: HTMLElement | null = null;

  const handleDocumentKeyDown = (event: KeyboardEvent): void => {
    if (!isOpen() || event.key !== 'Escape') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    void handleEscape();
  };

  host.style.cssText = [
    'position: fixed',
    'z-index: 2147483647',
    'inset: 0',
    'display: none',
    'pointer-events: none',
  ].join(';');

  style.textContent = cssText();
  root.className = 'surface';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'false');
  root.setAttribute('aria-label', 'Draftlet command surface');

  title.textContent = 'Draftlet';
  contextText.className = 'context';
  statusText.className = 'status';

  editor.className = 'editor';
  editor.placeholder = 'Generate a draft, then edit it here before inserting.';
  editor.rows = 7;

  actions.className = 'actions';
  configureButton(generateButton, 'Generate');
  configureButton(insertButton, 'Insert');
  configureButton(copyButton, 'Copy');
  configureButton(cancelButton, 'Cancel');
  configureButton(workshopButton, 'Open Workshop');
  configureButton(closeButton, 'Close');
  closeButton.className = 'ghost';
  copyButton.className = 'ghost';
  workshopButton.className = 'ghost';
  cancelButton.className = 'danger';

  actions.append(generateButton, insertButton, copyButton, cancelButton, workshopButton, closeButton);
  root.append(title, contextText, statusText, editor, actions);
  shadow.append(style, root);
  document.documentElement.append(host);

  editor.addEventListener('input', () => {
    state.userEdited = true;
    render();
  });

  root.addEventListener('keydown', (event) => {
    event.stopPropagation();

    if (event.key !== 'Escape') {
      return;
    }

    event.preventDefault();
    void handleEscape();
  });

  document.addEventListener('keydown', handleDocumentKeyDown, true);

  generateButton.addEventListener('click', () => {
    void generateDraft();
  });

  cancelButton.addEventListener('click', () => {
    void cancelGeneration();
  });

  insertButton.addEventListener('click', () => {
    void insertDraft();
  });

  copyButton.addEventListener('click', () => {
    void copyDraft();
  });

  workshopButton.addEventListener('click', () => {
    void openWorkshop();
  });

  closeButton.addEventListener('click', () => {
    close();
  });

  function open(context: DraftletSidePanelContext): void {
    restoreFocusTarget = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    state = {
      ...initialState(),
      context,
      statusMessage: context.selectedText
        ? 'Ready to generate from the selected context.'
        : 'Select text on the page before generating.',
    };
    editor.value = '';
    host.style.display = 'block';
    render();
    queueMicrotask(() => {
      if (context.selectedText.trim()) {
        generateButton.focus({ preventScroll: true });
      } else {
        editor.focus({ preventScroll: true });
      }
    });
  }

  function close(options: { restoreFocus?: boolean } = {}): void {
    if (isGenerating()) {
      return;
    }

    host.style.display = 'none';
    state = initialState();
    editor.value = '';
    if (options.restoreFocus !== false) {
      restorePageFocus();
    } else {
      restoreFocusTarget = null;
    }
  }

  function remove(): void {
    document.removeEventListener('keydown', handleDocumentKeyDown, true);
    host.remove();
  }

  function handleMessage(message: DraftletMessage): void {
    if (!state.sessionId) {
      return;
    }

    if (message.type === 'draftlet:draft-text-delta-received') {
      if (message.sessionId !== state.sessionId || message.generationId !== state.generationId) {
        return;
      }

      state.status = 'streaming';
      state.statusMessage = 'Drafting...';
      state.sentenceBuffer = appendSentenceBufferChunk(state.sentenceBuffer, message.text);
      if (state.userEdited) {
        editor.value = `${editor.value}${message.text}`;
      } else {
        editor.value = sentenceBufferText(state.sentenceBuffer);
      }
      render();
      return;
    }

    if (message.type === 'draftlet:conversation-thread-updated' && message.sessionId === state.sessionId) {
      applyThreadSnapshot(message.snapshot);
    }
  }

  async function generateDraft(): Promise<void> {
    if (!state.context?.selectedText.trim()) {
      setStatus('error', 'Select text on the page before generating.');
      return;
    }

    state = {
      ...state,
      status: 'starting',
      statusMessage: 'Starting draft...',
      generationId: undefined,
      threadId: undefined,
      turnId: undefined,
      sentenceBuffer: createSentenceBufferState(),
      userEdited: false,
    };
    editor.value = '';
    render();

    try {
      const sessionId = await ensureSessionId();
      if (!sessionId) {
        return;
      }

      const result = await callbacks.startGeneration(sessionId);
      if (!result.started || !result.generationId || !result.sessionId) {
        setStatus('error', result.error?.message ?? 'Could not start draft generation.');
        return;
      }

      state = {
        ...state,
        sessionId: result.sessionId,
        generationId: result.generationId,
        threadId: result.threadId,
        turnId: result.turnId,
        status: 'streaming',
        statusMessage: 'Drafting...',
      };
      render();
    } catch (error) {
      setStatus('error', error instanceof Error ? error.message : 'Could not reach Draftlet.');
    }
  }

  async function ensureSessionId(): Promise<string | null> {
    if (state.sessionId) {
      return state.sessionId;
    }

    if (!state.context) {
      setStatus('error', 'No page context is available.');
      return null;
    }

    const result = await callbacks.createSession(state.context);
    if (!result.created || !result.session) {
      setStatus('error', result.message ?? 'Could not create a Draftlet session for this page.');
      return null;
    }

    state.sessionId = result.session.sessionId;
    return result.session.sessionId;
  }

  async function cancelGeneration(): Promise<void> {
    if (!isGenerating()) {
      return;
    }

    const currentText = currentDraftText();
    state.sentenceBuffer = flushSentenceBuffer(state.sentenceBuffer);
    editor.value = currentText || sentenceBufferText(state.sentenceBuffer);
    await callbacks.cancelGeneration(state.sessionId, state.generationId).catch(() => undefined);
    state.status = 'cancelled';
    state.statusMessage = 'Generation cancelled. Partial draft kept for editing.';
    state.generationId = undefined;
    render();
  }

  async function insertDraft(): Promise<void> {
    const text = currentDraftText();
    if (!text) {
      setStatus('error', 'Generate or type a draft before inserting.');
      return;
    }

    const sessionId = await ensureSessionId();
    if (!sessionId) {
      return;
    }

    setStatus('idle', 'Inserting...');

    try {
      const targetStatus = await callbacks.getInsertionTargetStatus(sessionId).catch(() => null);
      if (targetStatus && targetStatus.status !== 'live') {
        state.statusMessage = targetStatus.message ?? insertionTargetMessage(targetStatus.status);
        render();
      }

      const result = await callbacks.insertDraft(sessionId, text);
      if (result.status === 'inserted') {
        state.status = 'inserted';
        state.statusMessage = result.message || 'Inserted.';
        render();
        close({ restoreFocus: false });
        return;
      }

      setStatus(result.status === 'copied' ? 'copied' : 'error', result.message || fallbackInsertionMessage(result));
    } catch (error) {
      setStatus('error', error instanceof Error ? error.message : 'Could not insert the draft.');
    }
  }

  async function copyDraft(): Promise<void> {
    const text = currentDraftText();
    if (!text) {
      setStatus('error', 'Generate or type a draft before copying.');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied', 'Copied draft. Paste it into the compose field when ready.');
    } catch {
      setStatus('error', 'Could not copy automatically. Select the draft text and copy it manually.');
      editor.focus({ preventScroll: true });
      editor.select();
    }
  }

  async function openWorkshop(): Promise<void> {
    if (!state.context) {
      return;
    }

    const opened = await callbacks.openWorkshop(state.context).catch(() => false);
    if (opened && !isGenerating()) {
      close();
    } else if (!opened) {
      setStatus('error', 'Could not open Workshop.');
    }
  }

  async function handleEscape(): Promise<void> {
    if (isGenerating()) {
      await cancelGeneration();
      return;
    }

    close();
  }

  function applyThreadSnapshot(snapshot: ConversationThreadSnapshot): void {
    if (!state.turnId) {
      return;
    }

    const turn = snapshot.turns.find((candidate) => candidate.turnId === state.turnId);
    if (!turn) {
      return;
    }

    if (turn.generationStatus === 'completed') {
      state.sentenceBuffer = flushSentenceBuffer(state.sentenceBuffer);
      const variant = snapshot.variants
        .filter((candidate) => candidate.turnId === turn.turnId)
        .sort((a, b) => a.rank - b.rank)
        .find((candidate) => candidate.isCurrent)
        ?? snapshot.variants.filter((candidate) => candidate.turnId === turn.turnId).sort((a, b) => a.rank - b.rank)[0];

      if (!state.userEdited && variant?.content) {
        editor.value = variant.content;
      } else if (!state.userEdited) {
        editor.value = sentenceBufferText(state.sentenceBuffer);
      }

      state.status = 'idle';
      state.statusMessage = editor.value.trim() ? 'Draft ready. Edit or insert it.' : 'No draft text was returned.';
      state.generationId = undefined;
      render();
      return;
    }

    if (turn.generationStatus === 'failed' || turn.generationStatus === 'cancelled') {
      state.status = turn.generationStatus === 'cancelled' ? 'cancelled' : 'error';
      state.statusMessage = turn.generationErrorMessage
        ?? (turn.generationStatus === 'cancelled' ? 'Generation cancelled. Partial draft kept for editing.' : 'Could not generate a draft.');
      state.generationId = undefined;
      render();
    }
  }

  function currentDraftText(): string {
    return editor.value.trim();
  }

  function isGenerating(): boolean {
    return state.status === 'starting' || state.status === 'streaming';
  }

  function setStatus(status: CommandSurfaceStatus, message: string): void {
    state.status = status;
    state.statusMessage = message;
    render();
  }

  function render(): void {
    const selectedText = state.context?.selectedText.trim() ?? '';
    contextText.textContent = selectedText
      ? `Context: ${selectedText.length > 180 ? `${selectedText.slice(0, 180)}...` : selectedText}`
      : 'No selected context captured.';
    statusText.textContent = state.statusMessage;
    root.dataset.status = state.status;
    generateButton.disabled = isGenerating();
    insertButton.disabled = isGenerating() || !currentDraftText();
    copyButton.disabled = isGenerating() || !currentDraftText();
    cancelButton.hidden = !isGenerating();
    closeButton.disabled = isGenerating();
  }

  function isOpen(): boolean {
    return host.style.display !== 'none';
  }

  function restorePageFocus(): void {
    const target = restoreFocusTarget;
    restoreFocusTarget = null;

    if (target?.isConnected && document.activeElement !== target) {
      target.focus({ preventScroll: true });
    }
  }

  return {
    open,
    handleMessage,
    close,
    remove,
    isOpen() {
      return isOpen();
    },
  };
}

function insertionTargetMessage(status: InsertionTargetStatusResult['status']): string {
  if (status === 'needs_focus' || status === 'needs_recapture') {
    return 'Focus a compose field, then try inserting again. Copy is available if insertion still fails.';
  }

  if (status === 'tab_disambiguation_required') {
    return 'Draftlet found multiple possible tabs. Open Workshop to choose a tab, or copy the draft.';
  }

  return 'Draftlet could not confirm the compose field. It will try to recover before falling back to copy.';
}

function fallbackInsertionMessage(result: InsertionResult): string {
  if (result.targetStatus === 'unavailable' || result.targetStatus === 'needs_recapture') {
    return 'Could not find a compose field. Copy the draft and paste it manually.';
  }

  return 'Could not insert the draft. Copy fallback is available.';
}

function initialState(): CommandSurfaceState {
  return {
    context: null,
    status: 'idle',
    statusMessage: 'Ready.',
    sentenceBuffer: createSentenceBufferState(),
    userEdited: false,
  };
}

function configureButton(button: HTMLButtonElement, label: string): void {
  button.type = 'button';
  button.textContent = label;
}

function cssText(): string {
  return `
    :host { all: initial; }
    .surface {
      pointer-events: auto;
      box-sizing: border-box;
      width: min(520px, calc(100vw - 32px));
      margin: 24px auto 0;
      padding: 16px;
      border: 1px solid rgba(148, 163, 184, 0.36);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.24), 0 1px 3px rgba(15, 23, 42, 0.16);
      color: #0f172a;
      font: 14px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      transform: translateY(0);
      transition: transform 140ms ease, opacity 140ms ease;
    }
    h2 {
      margin: 0 0 8px;
      font: 700 15px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .context, .status {
      margin: 0 0 10px;
      color: #475569;
      font-size: 12px;
    }
    .status { color: #2563eb; }
    [data-status="error"] .status { color: #b91c1c; }
    [data-status="cancelled"] .status { color: #a16207; }
    .editor {
      box-sizing: border-box;
      display: block;
      width: 100%;
      min-height: 136px;
      resize: vertical;
      padding: 11px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      outline: none;
      color: #0f172a;
      background: #f8fafc;
      font: 13px/1.5 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .editor:focus { border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2); }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    button {
      border: 0;
      border-radius: 999px;
      padding: 8px 12px;
      color: #fff;
      background: #2563eb;
      font: 650 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer;
      transition: transform 120ms ease, background 120ms ease, opacity 120ms ease;
    }
    button:hover:not(:disabled) { transform: translateY(-1px); background: #1d4ed8; }
    button:disabled { cursor: not-allowed; opacity: 0.5; }
    button.ghost { color: #334155; background: #e2e8f0; }
    button.ghost:hover:not(:disabled) { background: #cbd5e1; }
    button.danger { background: #dc2626; }
    button.danger:hover:not(:disabled) { background: #b91c1c; }
    @media (max-width: 520px) {
      .surface { margin-top: 12px; padding: 14px; border-radius: 16px; }
      .actions { align-items: stretch; flex-direction: column; }
      button { width: 100%; }
    }
  `;
}
