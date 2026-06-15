import type { ButtonHTMLAttributes } from 'react';

import { draftletControlTokens } from '../tokens/index';
import { cn } from '../utils/index';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'tab';
export type ControlSize = 'regular' | 'compact';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  size?: ControlSize;
  variant?: ButtonVariant;
}

export function Button({
  active = false,
  className,
  size = 'regular',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        buttonBaseClass(size),
        draftletControlTokens.focusRing,
        draftletControlTokens.disabled,
        buttonVariantClass(variant, size, active),
        className,
      )}
      {...props}
    />
  );
}

function buttonBaseClass(size: ControlSize) {
  if (size === 'compact') {
    return 'inline-flex h-8 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-semibold transition-colors duration-150';
  }

  return 'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-semibold leading-none transition-colors duration-150';
}

function buttonVariantClass(variant: ButtonVariant, size: ControlSize, active: boolean) {
  if (variant === 'primary') {
    return size === 'compact'
      ? 'bg-slate-900 px-3.5 text-white shadow-sm shadow-slate-200/70 hover:bg-slate-800'
      : 'bg-slate-900 text-white shadow-sm shadow-slate-200/70 hover:bg-slate-800';
  }

  if (variant === 'secondary') {
    return size === 'compact'
      ? 'bg-white px-3 text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-950 hover:ring-slate-300'
      : 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-950 hover:ring-slate-300';
  }

  if (variant === 'ghost') {
    return size === 'compact'
      ? 'h-8 w-8 bg-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-700'
      : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800';
  }

  if (variant === 'danger') {
    return 'bg-rose-50 text-rose-700 shadow-sm ring-1 ring-rose-200 hover:bg-rose-100 hover:text-rose-800';
  }

  return cn(
    'h-8 min-w-0 flex-1 bg-transparent px-1.5 text-[11px] text-slate-500 hover:bg-white/70 hover:text-slate-800',
    active && 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200 hover:bg-white hover:text-slate-950',
  );
}
