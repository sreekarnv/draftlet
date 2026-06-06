import type React from 'react';
import type { CommandStatus } from '../lib/types';
import { Badge, Card } from './ui';

interface StatusCardProps {
  action?: React.ReactNode;
  detail?: string;
  index?: string;
  status: CommandStatus;
  title: string;
}

function labelFor(status: CommandStatus) {
  if (status.ok) {
    return 'Ready';
  }

  if (status.code === 'missing') {
    return 'Missing';
  }

  if (status.code === 'not_running') {
    return 'Not running';
  }

  if (status.code === 'conflict') {
    return 'Conflict';
  }

  return 'Needs setup';
}

export function StatusCard({ action, detail, index, status, title }: StatusCardProps) {
  return (
    <Card className="content-start">
      <div className="flex items-start justify-between gap-3">
        <div>
          {index ? <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase text-slate-500">Step {index}</p> : null}
          <h2 className="m-0 text-base font-bold leading-tight text-slate-900">{title}</h2>
        </div>
        <Badge tone={status.ok ? 'success' : 'danger'}>{labelFor(status)}</Badge>
      </div>
      <p className="m-0 text-sm leading-6 text-slate-600">{status.message}</p>
      {detail ? <small className="text-[13px] leading-6 text-slate-500">{detail}</small> : null}
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </Card>
  );
}
