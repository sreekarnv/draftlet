import { CheckCircle2, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export type StatusTone = "idle" | "working" | "success" | "error";

export type StatusState = {
  message: string;
  tone: StatusTone;
};

interface StatusMessageProps {
  status: StatusState;
}

export function StatusMessage({ status }: StatusMessageProps) {
  return (
    <div
      className={cn(
        "bg-background/70 text-muted-foreground rounded-xl border p-3 text-xs leading-5",
        status.tone === "success" && "border-primary/40 text-foreground",
        status.tone === "error" && "border-destructive/50 text-foreground",
      )}
    >
      <div className="flex gap-2">
        {status.tone === "success" ? (
          <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" />
        ) : null}
        {status.tone === "error" ? (
          <TriangleAlert className="text-destructive mt-0.5 size-4 shrink-0" />
        ) : null}
        <span>{status.message}</span>
      </div>
    </div>
  );
}
