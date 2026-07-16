import { StatusBadge } from "@/components/status-dot";
import { ActivityItem } from "../types";

export interface ActivityListProps {
  items: ActivityItem[];
  emptyTitle: string;
  emptyDescription: string;
}

export function ActivityList({ items, emptyTitle, emptyDescription }: ActivityListProps) {
  if (items.length === 0) {
    return (
      <div>
        <p className="text-sm font-medium">{emptyTitle}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.slice(0, 4).map((item) => (
        <div key={item.title} className="group flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</p>
          </div>
          {item.status && item.status !== "ready" && item.status !== "generating" ? (
            <StatusBadge tone={item.status === "sent" ? "ready" : "generating"}>
              {item.status === "accepted" ? "Inserted" : "Sent"}
            </StatusBadge>
          ) : item.connector ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">{item.connector}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
