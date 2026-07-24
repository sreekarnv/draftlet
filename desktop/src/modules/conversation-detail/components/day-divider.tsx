export function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="bg-border/70 h-px flex-1" />
      <span className="bg-background text-muted-foreground rounded-full border px-3 py-1 text-[11px] font-medium tracking-[0.14em] uppercase">
        {label}
      </span>
      <div className="bg-border/70 h-px flex-1" />
    </div>
  );
}
