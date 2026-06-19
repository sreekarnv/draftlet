import { RECOMMENDED_MODEL } from '../lib/constants';
import type { CommandStatus, InstalledModel } from '../lib/types';
import { Badge, Button, Card } from './ui';

interface ModelCardProps {
  busy: boolean;
  canPullRecommendedModel: boolean;
  installedModels: InstalledModel[];
  recommendedStatus: CommandStatus;
  selectedModel: string;
  onPullRecommendedModel: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onSelectModel: (model: string) => Promise<void>;
}

export function ModelCard({
  busy,
  canPullRecommendedModel,
  installedModels,
  recommendedStatus,
  selectedModel,
  onPullRecommendedModel,
  onRefresh,
  onSelectModel,
}: ModelCardProps) {
  const hasInstalledModels = installedModels.length > 0;
  const activeModelInstalled = installedModels.some((model) => model.name === selectedModel);

  return (
    <Card className="col-span-full content-start">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase text-slate-500">Step 2</p>
          <h2 className="m-0 text-base font-bold leading-tight text-slate-900">Choose a model</h2>
        </div>
        <Badge tone={recommendedStatus.ok ? 'success' : 'neutral'}>{recommendedStatus.ok ? 'Recommended installed' : 'Recommended missing'}</Badge>
      </div>

      <div className="grid gap-1">
        <p className="m-0 text-sm leading-6 text-slate-600">
          {activeModelInstalled
            ? 'Draftlet will use the active Ollama model for drafts.'
            : 'Select or install a local Ollama model before generating drafts.'}
        </p>
        <small className="text-[13px] leading-6 text-slate-500">Active model: <strong className="font-bold text-slate-800">{selectedModel}</strong></small>
        <small className="text-[13px] leading-6 text-slate-500">
          Recommended onboarding model: <strong className="font-bold text-slate-800">{RECOMMENDED_MODEL}</strong>. Another installed model is okay if you select it.
        </small>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void onRefresh()} type="button">Refresh models</Button>
        {canPullRecommendedModel ? (
          <Button disabled={busy} onClick={() => void onPullRecommendedModel()} type="button">Pull recommended</Button>
        ) : null}
      </div>

      <div className="grid overflow-hidden rounded-lg bg-slate-200" role="list">
        {hasInstalledModels ? installedModels.map((model) => {
          const active = model.name === selectedModel;

          return (
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-3 py-2.5 last:border-b-0" key={model.name} role="listitem">
              <div className="grid gap-0.5">
                <strong className="font-bold text-slate-800">{model.name}</strong>
                {model.name === RECOMMENDED_MODEL ? <small className="text-[13px] leading-5 text-slate-500">Recommended onboarding model</small> : null}
              </div>
              <Button disabled={busy || active} onClick={() => void onSelectModel(model.name)} type="button" variant="secondary">
                {active ? 'Active' : 'Use model'}
              </Button>
            </div>
          );
        }) : (
          <p className="m-0 bg-white/90 p-3 text-sm leading-6 text-slate-600">No Ollama models found. Start Ollama, then pull {RECOMMENDED_MODEL}.</p>
        )}
      </div>
    </Card>
  );
}
