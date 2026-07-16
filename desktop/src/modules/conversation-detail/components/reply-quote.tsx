import type { Message } from "@/lib/contracts";
import { cn } from "@/shared/lib/utils";

export interface ReplyQuoteProps {
  target?: Message;
  unresolvedExternalId?: string;
  compact?: boolean;
}

export function ReplyQuote({ target, unresolvedExternalId, compact = false }: ReplyQuoteProps) {
  if (!target && !unresolvedExternalId) return null;

  return (
    <div
      className={cn(
        "mb-2 rounded-md border-l-2 border-primary/50 bg-background/60 px-3 py-2",
        compact && "px-2.5 py-1.5",
      )}
    >
      <p className="text-[11px] font-medium text-muted-foreground">
        Replying to {target?.author ?? "external message"}
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
        {target?.body ?? unresolvedExternalId}
      </p>
    </div>
  );
}
