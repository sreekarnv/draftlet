import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ className, variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-semibold leading-none transition-colors duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400/70',
        'disabled:pointer-events-none disabled:opacity-45',
        variant === 'primary' && 'bg-slate-900 text-white shadow-sm shadow-slate-200/70 hover:bg-slate-800',
        variant === 'secondary' && 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-950 hover:ring-slate-300',
        variant === 'ghost' && 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800',
        variant === 'danger' && 'bg-rose-50 text-rose-700 shadow-sm ring-1 ring-rose-200 hover:bg-rose-100 hover:text-rose-800',
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
        'inline-flex min-h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold leading-none ring-1 ring-inset',
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
    <section
      className={cn(
        'grid gap-3 rounded-xl bg-white/90 p-4 shadow-sm shadow-slate-200/70 ring-1 ring-slate-200/80',
        className,
      )}
      {...props}
    />
  );
}

export function Separator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('h-px bg-slate-200', className)} {...props} />;
}
