import { useEffect, useState } from 'react';

import { HelpPage } from './routes/HelpPage';
import { RuntimePage } from './routes/RuntimePage';
import { SetupPage } from './routes/SetupPage';
import { desktopApi } from './lib/api';
import { RECOMMENDED_MODEL } from './lib/constants';
import type { CommandStatus, InstalledModel, RuntimeState } from './lib/types';
import { Button } from './components/ui';

const UNKNOWN: CommandStatus = { ok: false, message: 'Not checked yet.', code: 'unknown' };

export default function App() {
  const [runtime, setRuntime] = useState<RuntimeState>({
    ollamaInstalled: UNKNOWN,
    ollamaRunning: UNKNOWN,
    model: UNKNOWN,
    installedModels: [],
    selectedModel: RECOMMENDED_MODEL,
    server: UNKNOWN,
  });
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const refreshStatus = async () => {
    setBusy(true);
    setActionMessage('');

    const [ollamaInstalled, server, selectedModel] = await Promise.all([
      desktopApi.checkOllamaInstalled(),
      desktopApi.checkServerHealth(),
      desktopApi.getSelectedModel(),
    ]);

    let ollamaRunning: CommandStatus = { ok: false, message: 'Install Ollama before checking runtime status.', code: 'missing' };
    let model: CommandStatus = { ok: false, message: 'Install Ollama before checking the recommended model.', code: 'missing' };
    let installedModels: InstalledModel[] = [];

    if (ollamaInstalled.ok) {
      [ollamaRunning, model, installedModels] = await Promise.all([
        desktopApi.checkOllamaRunning(),
        desktopApi.checkRecommendedModelInstalled(),
        desktopApi.listInstalledModels().catch(() => []),
      ]);
    }

    setRuntime({ ollamaInstalled, ollamaRunning, model, installedModels, selectedModel, server });
    setBusy(false);
  };

  const openOllamaInstallPage = async () => {
    setBusy(true);
    const result = await desktopApi.openOllamaInstallPage();
    setActionMessage(result.message);
    setBusy(false);
  };

  const openExtensionHelp = async () => {
    setBusy(true);
    const result = await desktopApi.openExtensionHelp();
    setActionMessage(result.message);
    setBusy(false);
  };

  const selectModel = async (model: string) => {
    setBusy(true);
    const result = await desktopApi.setSelectedModel(model);
    setActionMessage(result.message);
    await refreshStatus();
  };

  const pullRecommendedModel = async () => {
    setBusy(true);
    setActionMessage(`Pulling ${RECOMMENDED_MODEL}. This can take a while...`);
    const result = await desktopApi.pullRecommendedModel();
    setActionMessage(result.message);
    await refreshStatus();
  };

  const startServer = async () => {
    setBusy(true);
    const result = await desktopApi.startDraftletServer();
    setActionMessage(result.message);
    await refreshStatus();
  };

  const stopServer = async () => {
    setBusy(true);
    const result = await desktopApi.stopDraftletServer();
    setActionMessage(result.message);
    await refreshStatus();
  };

  const restartServer = async () => {
    setBusy(true);
    const stopResult = await desktopApi.stopDraftletServer();
    const startResult = await desktopApi.startDraftletServer();
    setActionMessage(`${stopResult.message} ${startResult.message}`);
    await refreshStatus();
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  return (
    <main className="mx-auto grid max-w-[980px] gap-3.5 p-4 md:p-6">
      <header className="flex items-start justify-between gap-5 overflow-hidden rounded-xl bg-[linear-gradient(180deg,#ffffff,#f4f7fb)] p-5 shadow-sm shadow-slate-200/70 ring-1 ring-slate-200/80 max-md:grid">
        <div>
          <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase text-slate-500">Draftlet Companion</p>
          <h1 className="m-0 font-serif text-[30px] font-semibold leading-tight tracking-[-0.01em] text-slate-950">Set up Draftlet locally</h1>
          <p className="m-0 mt-2 max-w-[650px] text-sm leading-6 text-slate-600">Prepare Ollama, choose a model, start the bundled Draftlet server, and load the browser extension.</p>
        </div>
        <Button disabled={busy} onClick={() => void refreshStatus()} type="button">
          {busy ? 'Working...' : 'Recheck all'}
        </Button>
      </header>

      <SetupPage
        busy={busy}
        onOpenOllamaInstallPage={openOllamaInstallPage}
        onPullRecommendedModel={pullRecommendedModel}
        onRecheck={refreshStatus}
        onSelectModel={selectModel}
        runtime={runtime}
      />
      <RuntimePage
        busy={busy}
        onRestartServer={restartServer}
        onStartServer={startServer}
        onStopServer={stopServer}
        runtime={runtime}
      />
      <HelpPage busy={busy} onOpenExtensionHelp={openExtensionHelp} runtime={runtime} />
      {actionMessage ? (
        <p className="m-0 rounded-xl bg-white/90 px-3.5 py-3 text-[13px] leading-6 text-slate-700 shadow-sm shadow-slate-200/70 ring-1 ring-slate-200/80" role="status">
          {actionMessage}
        </p>
      ) : null}
    </main>
  );
}
