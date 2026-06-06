import { AlertCircle, CheckCircle2 } from 'lucide-react';

import type { ConnectionStatus } from '../../core/types';
import { Badge } from './ui';

interface StatusBadgeProps {
  status: ConnectionStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const Icon = status === 'connected' ? CheckCircle2 : AlertCircle;

  return (
    <Badge aria-label={`Server ${status}`} tone={status === 'connected' ? 'success' : 'danger'}>
      <Icon aria-hidden="true" className="h-3 w-3" strokeWidth={2} />
      {status}
    </Badge>
  );
}
