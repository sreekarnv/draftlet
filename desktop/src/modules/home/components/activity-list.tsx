import { StatusBadge } from "@/components/status-dot";
import { type ActivityItem } from "../types";

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
        <p className="text-muted-foreground mt-1 text-xs leading-5">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.slice(0, 4).map((item) => (
        <div key={item.title} className="group flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <p className="text-muted-foreground mt-1 truncate text-xs">{item.detail}</p>
          </div>
          {item.status && item.status !== "ready" && item.status !== "generating" ? (
            <StatusBadge tone={item.status === "sent" ? "ready" : "generating"}>
              {item.status === "accepted" ? "Inserted" : "Sent"}
            </StatusBadge>
          ) : item.connector ? (
            <span className="text-muted-foreground shrink-0 text-[11px]">{item.connector}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
