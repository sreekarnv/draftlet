import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'tab';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  active?: boolean;
}

export function Button({ active = false, className, variant = 'secondary', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-8 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-semibold transition-colors duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400/70',
        'disabled:pointer-events-none disabled:opacity-45',
        variant === 'primary' && 'bg-slate-900 px-3.5 text-white shadow-sm shadow-slate-200/70 hover:bg-slate-800',
        variant === 'secondary' && 'bg-white px-3 text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-950 hover:ring-slate-300',
        variant === 'ghost' && 'h-8 w-8 bg-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-700',
        variant === 'tab' && cn(
          'h-8 min-w-0 flex-1 bg-transparent px-1.5 text-[11px] text-slate-500 hover:bg-white/70 hover:text-slate-800',
          active && 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200 hover:bg-white hover:text-slate-950',
        ),
        className,
      )}
      {...props}
    />
  );
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'success' | 'danger' | 'neutral';
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-5 ring-1 ring-inset',
        tone === 'success' && 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        tone === 'danger' && 'bg-rose-50 text-rose-700 ring-rose-200',
        tone === 'neutral' && 'bg-slate-100 text-slate-600 ring-slate-200',
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <article
      className={cn(
        'rounded-lg bg-white p-3 shadow-sm shadow-slate-200/70 ring-1 ring-slate-200/80',
        className,
      )}
      {...props}
    />
  );
}
