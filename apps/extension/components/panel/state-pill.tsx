import { cn } from './ui';

export function StatePill({ label, tone }: { label: string; tone: 'slate' | 'rose' }) {
  return (
    <span className={cn(
      'rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize leading-4 ring-1',
      tone === 'slate' && 'bg-slate-100 text-slate-700 ring-slate-200',
      tone === 'rose' && 'bg-rose-50 text-rose-700 ring-rose-200',
    )}>
      {label}
    </span>
  );
}
