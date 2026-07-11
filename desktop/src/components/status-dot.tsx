import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

export type StatusTone = "ready" | "warning" | "offline" | "error" | "generating";

const toneClass: Record<StatusTone, string> = {
  ready: "bg-primary",
  warning: "bg-amber-500/80",
  offline: "bg-muted-foreground/70",
  error: "bg-destructive",
  generating: "bg-teal-400/80",
};

export function StatusDot({ tone, className }: { tone: StatusTone; className?: string }) {
  return (
    <span className={cn("size-2 rounded-full", toneClass[tone], className)} aria-hidden="true" />
  );
}

export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <StatusDot tone={tone} />
      {children}
    </span>
  );
}
