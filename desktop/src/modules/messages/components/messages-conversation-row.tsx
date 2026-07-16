import type { Conversation } from "@/lib/contracts";
import { formatTime, getInitials } from "@/modules/conversation-detail/utils";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { cn } from "@/shared/lib/utils";

export interface MessagesConversationRowProps {
  conversation: Conversation;
  selected: boolean;
  onSelect: () => void;
}

export function MessagesConversationRow({
  conversation,
  selected,
  onSelect,
}: MessagesConversationRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/70",
        selected && "bg-primary/10 hover:bg-primary/10",
      )}
    >
      <Avatar className="mt-0.5" size="default">
        <AvatarFallback>{getInitials(conversation.title || conversation.contact)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-semibold tracking-tight">{conversation.title}</p>
          <time className="shrink-0 text-[11px] text-muted-foreground">
            {formatTime(conversation.timestamp)}
          </time>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {conversation.participants || conversation.contact}
        </p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {conversation.latestMessage}
        </p>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{conversation.messages.length} messages</span>
          {conversation.latestDraftId ? <span>Draft ready</span> : null}
          {conversation.recentlyCaptured ? (
            <span className="text-primary">New local capture</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
