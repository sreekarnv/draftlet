import type { HTMLAttributes } from 'react';

import { cn } from '../utils/index';
import type { ControlSize } from './button';

type CardElement = 'article' | 'section' | 'div';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: CardElement;
  size?: ControlSize;
}

export function Card({ as: Component = 'section', className, size = 'regular', ...props }: CardProps) {
  return (
    <Component
      className={cn(
        size === 'compact'
          ? 'rounded-lg bg-white p-3 shadow-sm shadow-slate-200/70 ring-1 ring-slate-200/80'
          : 'grid gap-3 rounded-xl bg-white/90 p-4 shadow-sm shadow-slate-200/70 ring-1 ring-slate-200/80',
        className,
      )}
      {...props}
    />
  );
}
