import type { ReactNode } from 'react';

export function EmptyState({ children, title }: { children?: ReactNode; title: string }) {
  return (
    <div className="grid gap-2.5 rounded-lg bg-white/70 p-3.5 text-[13px] leading-6 text-slate-500 ring-1 ring-slate-200/70">
      <p className="m-0">{title}</p>
      {children}
    </div>
  );
}
