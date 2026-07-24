import { CheckCircle2, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export type StatusTone = "idle" | "working" | "success" | "error";

export type StatusState = {
  message: string;
  tone: StatusTone;
};

interface StatusMessageProps {
  status: StatusState;
};

export function StatusMessage({ status }: StatusMessageProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-background/70 p-3 text-xs leading-5 text-muted-foreground",
        status.tone === "success" && "border-primary/40 text-foreground",
        status.tone === "error" && "border-destructive/50 text-foreground",
      )}
    >
      <div className="flex gap-2">
        {status.tone === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> : null}
        {status.tone === "error" ? (
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
        ) : null}
        <span>{status.message}</span>
      </div>
    </div>
  );
}
