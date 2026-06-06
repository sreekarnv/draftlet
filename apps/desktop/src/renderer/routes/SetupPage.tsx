import { ModelCard } from '../components/ModelCard';
import { SetupChecklist } from '../components/SetupChecklist';
import { StatusCard } from '../components/StatusCard';
import { Button } from '../components/ui';
import type { RuntimeState } from '../lib/types';

interface SetupPageProps {
  busy: boolean;
  runtime: RuntimeState;
  onOpenOllamaInstallPage: () => Promise<void>;
  onPullRecommendedModel: () => Promise<void>;
  onRecheck: () => Promise<void>;
  onSelectModel: (model: string) => Promise<void>;
}

export function SetupPage({
  busy,
  runtime,
  onOpenOllamaInstallPage,
  onPullRecommendedModel,
  onRecheck,
  onSelectModel,
}: SetupPageProps) {
  const ollamaStatus = runtime.ollamaInstalled.ok ? runtime.ollamaRunning : runtime.ollamaInstalled;

  return (
    <section className="grid grid-cols-2 gap-3 max-[820px]:grid-cols-1">
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
    </section>
  );
}
