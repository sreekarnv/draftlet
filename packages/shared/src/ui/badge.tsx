import type { HTMLAttributes } from 'react';

import { cn } from '../utils/index';
import type { ControlSize } from './button';

export type BadgeTone = 'success' | 'danger' | 'neutral';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  size?: ControlSize;
  tone?: BadgeTone;
}

export function Badge({ className, size = 'regular', tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        size === 'compact'
          ? 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-5 ring-1 ring-inset'
          : 'inline-flex min-h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold leading-none ring-1 ring-inset',
        tone === 'success' && 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        tone === 'danger' && 'bg-rose-50 text-rose-700 ring-rose-200',
        tone === 'neutral' && 'bg-slate-100 text-slate-600 ring-slate-200',
        className,
      )}
      {...props}
    />
  );
}
