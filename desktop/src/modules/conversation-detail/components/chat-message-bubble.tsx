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
}

export function ChatMessageBubble({ message, replyTarget }: ChatMessageBubbleProps) {
  const direction = getMessageDirection(message);
  const outgoing = direction === "outgoing";
  const local = direction === "local" || direction === "draft";

  return (
    <div className={cn("flex gap-3", outgoing || local ? "justify-end" : "justify-start")}>
      {!outgoing && !local ? (
        <Avatar size="sm" className="mt-1">
          <AvatarFallback>{getInitials(message.author)}</AvatarFallback>
        </Avatar>
      ) : null}
      <div
        className={cn(
          "max-w-[78%] sm:max-w-[68%]",
          outgoing || local ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-3 shadow-sm ring-1",
            outgoing && "rounded-br-md bg-primary text-primary-foreground ring-primary/20",
            local && "rounded-br-md border border-dashed bg-muted/70 text-foreground ring-border",
            !outgoing && !local && "rounded-bl-md bg-card text-card-foreground ring-border/70",
          )}
        >
          <ReplyQuote
            target={replyTarget}
            unresolvedExternalId={!replyTarget ? message.replyToExternalMessageId : undefined}
            compact
          />
          {!outgoing && !local ? (
            <p className="mb-1 text-xs font-medium">{message.author}</p>
          ) : null}
          <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
        </div>
        <p
          className={cn(
            "mt-1.5 px-1 text-[11px] text-muted-foreground",
            outgoing || local ? "text-right" : "text-left",
          )}
        >
          {getMessageLabel(message)} · {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
