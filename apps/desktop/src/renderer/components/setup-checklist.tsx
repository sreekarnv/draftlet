import { RECOMMENDED_MODEL } from '../lib/constants';
import type { RuntimeState } from '../lib/types';
import { Badge, Card } from './ui';

interface SetupChecklistProps {
  runtime: RuntimeState;
}

function readinessLabel(done: number, total: number): string {
  if (done === total) {
    return 'Ready';
  }

  if (done === 0) {
    return 'Not started';
  }

  return 'In progress';
}

export function SetupChecklist({ runtime }: SetupChecklistProps) {
  const activeModelInstalled = runtime.installedModels.some((model) => model.name === runtime.selectedModel);
  const recommendedModelText = runtime.model.ok ? 'Recommended model installed' : 'Recommended model missing';
  const ready = runtime.ollamaInstalled.ok && runtime.ollamaRunning.ok && activeModelInstalled && runtime.server.ok;
  const items = [
    { label: 'Ollama installed', ok: runtime.ollamaInstalled.ok },
    { label: 'Ollama running', ok: runtime.ollamaRunning.ok },
    { label: `Active model installed: ${runtime.selectedModel}`, ok: activeModelInstalled },
    { label: 'Draftlet server reachable', ok: runtime.server.ok },
  ];
  const done = items.filter((item) => item.ok).length;

  return (
    <Card className="content-start bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase text-slate-500">Local setup readiness</p>
          <h2 className="m-0 text-base font-bold leading-tight text-slate-900">{readinessLabel(done, items.length)}</h2>
        </div>
        <Badge>{done}/{items.length}</Badge>
      </div>
      <div className="h-[7px] overflow-hidden rounded-full bg-slate-200 shadow-inner shadow-slate-300/30" aria-hidden="true">
        <span className="block h-full rounded-full bg-[linear-gradient(90deg,#0f172a,#64748b)] transition-[width] duration-150" style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      <ul className="m-0 grid gap-2 p-0">
        {items.map((item) => (
          <li className={item.ok ? 'flex gap-2 text-sm leading-6 text-emerald-700' : 'flex gap-2 text-sm leading-6 text-slate-600'} key={item.label}>
            <span aria-hidden="true">{item.ok ? '✓' : '○'}</span>
            {item.label}
          </li>
        ))}
      </ul>
      <p className="m-0 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold leading-5 text-slate-600 ring-1 ring-slate-200">
        {recommendedModelText}: {RECOMMENDED_MODEL}
      </p>
      <p className="m-0 text-xs leading-5 text-slate-600">
        {ready ? 'Local setup is ready. Load the browser extension, select text on a page, and generate a draft.' : 'Complete the local setup checks, then load the browser extension and try a draft.'}
      </p>
    </Card>
  );
}
