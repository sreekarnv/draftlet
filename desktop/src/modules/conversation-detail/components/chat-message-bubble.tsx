import type { Message } from "@/lib/contracts";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { cn } from "@/shared/lib/utils";
import {
  getInitials,
  getMessageDirection,
  getMessageLabel,
  formatTime,
} from "@/modules/conversation-detail/utils";
import { ReplyQuote } from "@/modules/conversation-detail/components/reply-quote";

export interface ChatMessageBubbleProps {
  message: Message;
  replyTarget?: Message;
  compact?: boolean;
}

export function ChatMessageBubble({
  message,
  replyTarget,
  compact = false,
}: ChatMessageBubbleProps) {
  const direction = getMessageDirection(message);
  const outgoing = direction === "outgoing";
  const local = direction === "local" || direction === "draft";
  const incoming = !outgoing && !local;
  const metaLabel = incoming
    ? formatTime(message.timestamp)
    : `${getMessageLabel(message)} · ${formatTime(message.timestamp)}`;

  return (
    <div
      className={cn(
        "group flex gap-2.5",
        outgoing || local ? "justify-end" : "justify-start",
        compact ? "mt-0.5" : "mt-3 first:mt-0",
      )}
    >
      {incoming && !compact ? (
        <Avatar size="sm" className="ring-border/60 mt-1.5 ring-1">
          <AvatarFallback>{getInitials(message.author)}</AvatarFallback>
        </Avatar>
      ) : null}
      {incoming && compact ? <div className="w-8 shrink-0" /> : null}
      <div
        className={cn(
          "flex max-w-[82%] flex-col sm:max-w-[66%]",
          outgoing || local ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-3 shadow-sm ring-1 transition-colors",
            outgoing && "bg-primary text-primary-foreground ring-primary/20 rounded-br-md",
            local && "bg-muted/70 text-foreground ring-border rounded-br-md border border-dashed",
            incoming && "bg-card/95 text-card-foreground ring-border/70 rounded-bl-md",
            compact && incoming && "rounded-tl-md",
            compact && (outgoing || local) && "rounded-tr-md",
          )}
        >
          <ReplyQuote
            target={replyTarget}
            unresolvedExternalId={!replyTarget ? message.replyToExternalMessageId : undefined}
            compact
          />
          {incoming && !compact ? (
            <p className="text-muted-foreground mb-1.5 text-xs font-semibold">{message.author}</p>
          ) : null}
          <p className="text-[14px] leading-6 whitespace-pre-wrap">{message.body}</p>
        </div>
        <p
          className={cn(
            "text-muted-foreground/80 mt-1 px-1 text-[11px] opacity-80 transition-opacity group-hover:opacity-100",
            outgoing || local ? "text-right" : "text-left",
          )}
        >
          {metaLabel}
        </p>
      </div>
    </div>
  );
}
