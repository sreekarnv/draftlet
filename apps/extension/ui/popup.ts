import {
  GET_RECAPTURE_DIAGNOSTICS,
  GET_RUNTIME_STATUS,
  PUBLISH_RECAPTURE_DIAGNOSTICS_REPORT,
  type DraftletMessage,
  type PublishRecaptureDiagnosticsReportResult,
  type RecaptureDiagnosticEntry,
  type RecaptureDiagnosticsResult,
  type RuntimeStatusResult,
} from '../core/messages';
import {
  formatDiagnosticTime,
  recaptureDiagnosticEventLabel,
  recaptureDiagnosticLevelLabel,
  serializeRecaptureDiagnostics,
} from '../core/recapture-diagnostics-view';

const root = document.getElementById('root');
let latestDiagnostics: RecaptureDiagnosticEntry[] = [];

if (!root) {
  throw new Error('Draftlet popup root was not found.');
}

root.innerHTML = `
  <main class="draftlet-popup" aria-label="Draftlet status">
    <header class="popup-header">
      <div>
        <h1>Draftlet</h1>
        <p>Extension status</p>
      </div>
      <button class="icon-button" id="refresh" type="button" aria-label="Refresh diagnostics">Refresh</button>
    </header>
    <section class="status-row" aria-label="Runtime status">
      <span class="label">Runtime</span>
      <span class="pill" id="runtime-status">Checking...</span>
    </section>
    <section class="diagnostics" aria-label="Recapture diagnostics">
      <div class="section-header">
        <div class="section-title">Recapture diagnostics</div>
        <div class="button-row">
          <button class="secondary-button" id="publish-diagnostics" type="button">Send to desktop</button>
          <button class="secondary-button" id="copy-diagnostics" type="button">Copy</button>
        </div>
      </div>
      <div id="diagnostics-list" class="diagnostics-list">Loading...</div>
      <div id="copy-status" class="copy-status" role="status"></div>
    </section>
  </main>
`;

const runtimeStatus = requireElement('runtime-status');
const diagnosticsList = requireElement('diagnostics-list');
const refreshButton = requireElement('refresh') as HTMLButtonElement;
const publishButton = requireElement('publish-diagnostics') as HTMLButtonElement;
const copyButton = requireElement('copy-diagnostics') as HTMLButtonElement;
const copyStatus = requireElement('copy-status');

installStyles();
void refreshPopup();

refreshButton.addEventListener('click', () => {
  void refreshPopup();
});

copyButton.addEventListener('click', () => {
  void copyDiagnostics();
});

publishButton.addEventListener('click', () => {
  void publishDiagnostics();
});

async function refreshPopup() {
  refreshButton.disabled = true;
  publishButton.disabled = true;
  copyButton.disabled = true;
  copyStatus.textContent = '';
  runtimeStatus.textContent = 'Checking...';
  runtimeStatus.className = 'pill';
  diagnosticsList.textContent = 'Loading...';

  const [runtime, diagnostics] = await Promise.all([
    loadRuntimeStatus(),
    loadRecaptureDiagnostics(),
  ]);

  runtimeStatus.textContent = runtime.status === 'connected' ? 'Connected' : 'Disconnected';
  runtimeStatus.className = `pill ${runtime.status === 'connected' ? 'success' : 'failed'}`;
  latestDiagnostics = diagnostics.entries;
  renderDiagnostics(diagnostics.entries);
  refreshButton.disabled = false;
  publishButton.disabled = diagnostics.entries.length === 0;
  copyButton.disabled = diagnostics.entries.length === 0;
}

async function copyDiagnostics() {
  if (latestDiagnostics.length === 0) {
    copyStatus.textContent = 'No diagnostics to copy.';
    return;
  }

  try {
    await navigator.clipboard.writeText(serializeRecaptureDiagnostics(latestDiagnostics));
    copyStatus.textContent = 'Copied diagnostics.';
  } catch {
    copyStatus.textContent = 'Could not copy diagnostics.';
  }
}

async function publishDiagnostics() {
  if (latestDiagnostics.length === 0) {
    copyStatus.textContent = 'No diagnostics to send.';
    return;
  }

  publishButton.disabled = true;
  copyStatus.textContent = 'Sending diagnostics to desktop...';

  try {
    const result = await browser.runtime.sendMessage({
      type: PUBLISH_RECAPTURE_DIAGNOSTICS_REPORT,
      limit: 50,
    } satisfies DraftletMessage) as PublishRecaptureDiagnosticsReportResult;

    copyStatus.textContent = result.ok
      ? 'Sent diagnostics to desktop.'
      : result.error.message;
  } catch {
    copyStatus.textContent = 'Could not send diagnostics to desktop.';
  } finally {
    publishButton.disabled = latestDiagnostics.length === 0;
  }
}

async function loadRuntimeStatus(): Promise<RuntimeStatusResult> {
  try {
    return await browser.runtime.sendMessage({
      type: GET_RUNTIME_STATUS,
    } satisfies DraftletMessage) as RuntimeStatusResult;
  } catch {
    return { status: 'disconnected' };
  }
}

async function loadRecaptureDiagnostics(): Promise<RecaptureDiagnosticsResult> {
  try {
    return await browser.runtime.sendMessage({
      type: GET_RECAPTURE_DIAGNOSTICS,
      limit: 8,
    } satisfies DraftletMessage) as RecaptureDiagnosticsResult;
  } catch {
    return {
      entries: [
        {
          id: 0,
          event: 'content_recapture_failed',
          level: 'error',
          sessionId: 'unknown',
          message: 'Could not read recapture diagnostics.',
          at: new Date().toISOString(),
        },
      ],
    };
  }
}

function renderDiagnostics(entries: RecaptureDiagnosticEntry[]) {
  if (entries.length === 0) {
    diagnosticsList.innerHTML = '<div class="empty">No recapture diagnostics yet.</div>';
    return;
  }

  diagnosticsList.innerHTML = '';
  for (const entry of [...entries].reverse()) {
    const item = document.createElement('article');
    item.className = 'diagnostic-item';
    item.innerHTML = `
      <div class="diagnostic-meta">
        <span class="dot ${entry.level}"></span>
        <span class="event"></span>
        <span class="level"></span>
      </div>
      <div class="message"></div>
      <div class="hint"></div>
    `;
    item.querySelector('.event')!.textContent = recaptureDiagnosticEventLabel(entry);
    item.querySelector('.level')!.textContent = recaptureDiagnosticLevelLabel(entry.level);
    item.querySelector('.message')!.textContent = entry.message;
    item.querySelector('.hint')!.textContent = diagnosticHint(entry);
    diagnosticsList.append(item);
  }
}

function diagnosticHint(entry: RecaptureDiagnosticEntry): string {
  const parts = [
    formatDiagnosticTime(entry.at),
    entry.tabId === undefined ? '' : `tab ${entry.tabId}`,
    entry.status ?? '',
    entry.outcome ?? '',
  ].filter(Boolean);

  return parts.join(' / ');
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Draftlet popup element ${id} was not found.`);
  }

  return element;
}

function installStyles() {
  const style = document.createElement('style');
  style.textContent = `
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #0f172a;
      background: #f8fafc;
    }

    body {
      margin: 0;
      min-width: 320px;
      max-width: 360px;
      background: #f8fafc;
    }

    .draftlet-popup {
      display: grid;
      gap: 12px;
      padding: 14px;
    }

    .popup-header {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 12px;
    }

    h1 {
      margin: 0;
      font-size: 18px;
      line-height: 24px;
      font-weight: 700;
      letter-spacing: 0;
    }

    p {
      margin: 1px 0 0;
      color: #64748b;
      font-size: 11px;
      line-height: 16px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0;
    }

    button {
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #334155;
      border-radius: 6px;
      padding: 5px 8px;
      font: inherit;
      font-size: 12px;
      line-height: 16px;
      cursor: pointer;
    }

    button:disabled {
      cursor: default;
      opacity: 0.55;
    }

    .status-row,
    .diagnostics {
      display: grid;
      gap: 8px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      padding: 10px;
    }

    .status-row {
      grid-template-columns: 1fr auto;
      align-items: center;
    }

    .label,
    .section-title {
      color: #475569;
      font-size: 12px;
      line-height: 16px;
      font-weight: 700;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .button-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 5px;
    }

    .secondary-button {
      padding: 3px 7px;
      font-size: 11px;
      line-height: 15px;
    }

    .pill {
      border-radius: 999px;
      background: #f1f5f9;
      color: #475569;
      padding: 2px 8px;
      font-size: 11px;
      line-height: 16px;
      font-weight: 700;
    }

    .pill.success {
      background: #dcfce7;
      color: #166534;
    }

    .pill.failed {
      background: #fee2e2;
      color: #991b1b;
    }

    .diagnostics-list {
      display: grid;
      gap: 7px;
      max-height: 280px;
      overflow-y: auto;
    }

    .diagnostic-item {
      display: grid;
      gap: 3px;
      border-top: 1px solid #f1f5f9;
      padding-top: 7px;
    }

    .diagnostic-item:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .diagnostic-meta {
      display: flex;
      align-items: center;
      min-width: 0;
      gap: 6px;
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: #94a3b8;
      flex: 0 0 auto;
    }

    .dot.info {
      background: #0ea5e9;
    }

    .dot.warning {
      background: #f59e0b;
    }

    .dot.error {
      background: #ef4444;
    }

    .event {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #0f172a;
      font-size: 12px;
      line-height: 16px;
      font-weight: 700;
    }

    .level,
    .hint,
    .empty,
    .copy-status {
      color: #64748b;
      font-size: 11px;
      line-height: 16px;
    }

    .level {
      margin-left: auto;
      flex: 0 0 auto;
      font-weight: 700;
    }

    .message {
      color: #334155;
      font-size: 12px;
      line-height: 17px;
    }
  `;
  document.head.append(style);
}
