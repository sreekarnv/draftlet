import { StatusDot, StatusTone } from "@/components/status-dot";
import { StatusItem } from "@/modules/home/types";

export interface StatusSummaryProps {
  items: StatusItem[];
}

export function StatusSummary({ items }: StatusSummaryProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-start gap-3">
          <StatusDot tone={item.state as StatusTone} className="mt-1.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium">{item.label}</p>
              <span className="text-[11px] text-muted-foreground">{item.state}</span>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
