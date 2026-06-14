import { Button } from './ui';

interface AppHeaderProps {
  busy: boolean;
  onRefreshStatus: () => Promise<void>;
}

export function AppHeader({ busy, onRefreshStatus }: AppHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-5 overflow-hidden rounded-xl bg-[linear-gradient(180deg,#ffffff,#f4f7fb)] p-5 shadow-sm shadow-slate-200/70 ring-1 ring-slate-200/80 max-md:grid">
      <div>
        <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase text-slate-500">Draftlet Companion</p>
        <h1 className="m-0 font-serif text-[30px] font-semibold leading-tight tracking-[-0.01em] text-slate-950">
          Set up Draftlet locally
        </h1>
        <p className="m-0 mt-2 max-w-[650px] text-sm leading-6 text-slate-600">
          Prepare Ollama, choose a model, start the bundled Draftlet server, and load the browser extension.
        </p>
      </div>
      <Button disabled={busy} onClick={() => void onRefreshStatus()} type="button">
        {busy ? 'Working...' : 'Recheck all'}
      </Button>
    </header>
  );
}
