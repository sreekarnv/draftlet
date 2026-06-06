import { OLLAMA_BASE_URL, SERVER_BASE_URL } from '../lib/constants';
import { Badge, Button, Card } from './ui';

interface HelpCardProps {
  busy: boolean;
  ready: boolean;
  onOpenExtensionHelp: () => Promise<void>;
}

export function HelpCard({ busy, ready, onOpenExtensionHelp }: HelpCardProps) {
  return (
    <Card className="col-span-full content-start">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase text-slate-500">Step 4</p>
          <h2 className="m-0 text-base font-bold leading-tight text-slate-900">Load the browser extension</h2>
        </div>
        <Badge tone={ready ? 'success' : 'neutral'}>{ready ? 'Server ready' : 'After setup'}</Badge>
      </div>
      <p className="m-0 text-sm leading-6 text-slate-600">Open Chrome extensions, enable Developer mode, and load the unpacked extension build.</p>
      <ol className="m-0 grid gap-2 pl-5 text-sm leading-6 text-slate-600">
        <li>Build the extension with <code className="rounded bg-slate-100 px-1 py-0.5 text-[0.92em] text-slate-950">pnpm --dir apps/extension build</code>.</li>
        <li>Open Chrome extensions.</li>
        <li>Choose Load unpacked and select <code className="rounded bg-slate-100 px-1 py-0.5 text-[0.92em] text-slate-950">apps/extension/.output/chrome-mv3</code>.</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void onOpenExtensionHelp()} type="button">Open extension help</Button>
      </div>
      <p className="m-0 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold leading-5 text-slate-700 ring-1 ring-slate-200">Ollama: {OLLAMA_BASE_URL} · Server: {SERVER_BASE_URL}</p>
    </Card>
  );
}
