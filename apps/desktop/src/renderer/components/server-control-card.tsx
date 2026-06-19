import type { CommandStatus } from '../lib/types';
import { Badge, Button, Card } from './ui';

interface ServerControlCardProps {
  busy: boolean;
  status: CommandStatus;
  onRestart: () => Promise<void>;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
}

function serverLabel(status: CommandStatus) {
  if (status.ok) {
    return 'Ready';
  }

  if (status.code === 'conflict') {
    return 'Conflict';
  }

  return 'Not running';
}

export function ServerControlCard({ busy, status, onRestart, onStart, onStop }: ServerControlCardProps) {
  return (
    <Card className="col-span-full content-start">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase text-slate-500">Step 3</p>
          <h2 className="m-0 text-base font-bold leading-tight text-slate-900">Start local Draftlet server</h2>
        </div>
        <Badge tone={status.ok ? 'success' : 'danger'}>{serverLabel(status)}</Badge>
      </div>
      <p className="m-0 text-sm leading-6 text-slate-600">{status.message}</p>
      <small className="text-[13px] leading-6 text-slate-500">The browser extension connects to http://127.0.0.1:47632.</small>
      <small className="text-[13px] leading-6 text-slate-500">Packaged builds launch the bundled Python server. Development builds use the local uv server command.</small>
      {status.code === 'conflict' ? <small className="text-[13px] leading-6 text-rose-700">Another service is using Draftlet's port. Draftlet will not stop or replace it unless /health identifies it as Draftlet.</small> : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || status.ok || status.code === 'conflict'} onClick={() => void onStart()} type="button">Start server</Button>
        <Button disabled={busy || !status.ok} onClick={() => void onRestart()} type="button" variant="secondary">Restart server</Button>
        <Button disabled={busy || (!status.ok && status.code !== 'conflict')} onClick={() => void onStop()} type="button" variant="danger">Stop server</Button>
      </div>
    </Card>
  );
}
