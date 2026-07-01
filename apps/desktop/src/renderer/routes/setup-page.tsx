import { ModelCard } from '../components/model-card';
import { SetupChecklist } from '../components/setup-checklist';
import { StatusCard } from '../components/status-card';
import { Button } from '../components/ui';
import type { RuntimeState } from '../lib/types';

interface SetupPageProps {
  busy: boolean;
  runtime: RuntimeState;
  onOpenOllamaInstallPage: () => Promise<void>;
  onPullRecommendedModel: () => Promise<void>;
  onRecheck: () => Promise<void>;
  onSelectModel: (model: string) => Promise<void>;
  onCompleteSetup: () => Promise<void>;
  setupComplete: boolean;
}

export function SetupPage({
  busy,
  runtime,
  onOpenOllamaInstallPage,
  onPullRecommendedModel,
  onRecheck,
  onSelectModel,
  onCompleteSetup,
  setupComplete,
}: SetupPageProps) {
  const ollamaStatus = runtime.ollamaInstalled.ok ? runtime.ollamaRunning : runtime.ollamaInstalled;
  const canCompleteSetup = runtime.ollamaRunning.ok && Boolean(runtime.selectedModel);

  return (
    <div className="grid grid-cols-2 gap-3 max-[820px]:grid-cols-1">
      <SetupChecklist runtime={runtime} />

      <StatusCard
        action={
          !runtime.ollamaInstalled.ok ? (
            <Button disabled={busy} onClick={() => void onOpenOllamaInstallPage()} type="button">Install Ollama</Button>
          ) : (
            <Button disabled={busy} onClick={() => void onRecheck()} type="button">Recheck</Button>
          )
        }
        detail="Draftlet uses Ollama at http://127.0.0.1:11434. Ollama is not bundled."
        index="1"
        status={ollamaStatus}
        title="Ollama runtime"
      />

      <ModelCard
        busy={busy}
        canPullRecommendedModel={runtime.ollamaRunning.ok && runtime.model.code === 'missing'}
        installedModels={runtime.installedModels}
        onPullRecommendedModel={onPullRecommendedModel}
        onRefresh={onRecheck}
        onSelectModel={onSelectModel}
        recommendedStatus={runtime.model}
        selectedModel={runtime.selectedModel}
      />
      <div className="col-span-full rounded-xl bg-white/90 p-4 shadow-sm shadow-slate-200/70 ring-1 ring-slate-200/80">
        <div className="flex items-center justify-between gap-3 max-sm:grid">
          <div>
            <p className="m-0 mb-1 text-[11px] font-semibold uppercase text-slate-500">Tray startup</p>
            <h2 className="m-0 text-base font-bold leading-tight text-slate-900">
              {setupComplete ? 'Setup complete' : 'Finish first-run setup'}
            </h2>
            <p className="m-0 mt-1 text-sm leading-6 text-slate-600">
              {setupComplete
                ? 'Draftlet will start quietly in the tray and manage the local runtime from there.'
                : 'After Ollama is running and a model is selected, Draftlet can run as a tray-first daemon on future launches.'}
            </p>
          </div>
          <Button disabled={busy || setupComplete || !canCompleteSetup} onClick={() => void onCompleteSetup()} type="button">
            {setupComplete ? 'Completed' : 'Finish setup'}
          </Button>
        </div>
      </div>
    </div>
  );
}
