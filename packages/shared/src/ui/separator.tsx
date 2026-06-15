import type { HTMLAttributes } from 'react';

import { cn } from '../utils/index';

export function Separator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('h-px bg-slate-200', className)} {...props} />;
}
