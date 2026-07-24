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

export interface StatusDotProps {
  tone: StatusTone;
  className?: string;
}

export function StatusDot({ tone, className }: StatusDotProps) {
  return (
    <span className={cn("size-2 rounded-full", toneClass[tone], className)} aria-hidden="true" />
  );
}

export interface StatusBadgeProps {
  tone: StatusTone;
  children: ReactNode;
}

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
      <StatusDot tone={tone} />
      {children}
    </span>
  );
}
