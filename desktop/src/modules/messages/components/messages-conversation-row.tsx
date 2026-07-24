import type { Conversation } from "@/lib/contracts";
import { formatTime, getInitials } from "@/modules/conversation-detail/utils";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { cn } from "@/shared/lib/utils";

export interface MessagesConversationRowProps {
  conversation: Conversation;
  selected: boolean;
  onSelect: () => void;
}

function normalizeLabel(value?: string | null) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function getSecondaryLabel(conversation: Conversation) {
  const primary = normalizeLabel(
    conversation.title || conversation.contact || conversation.participants,
  );
  const candidates = [conversation.participants, conversation.contact];
  return candidates.find((candidate) => candidate && normalizeLabel(candidate) !== primary);
}

export function MessagesConversationRow({
  conversation,
  selected,
  onSelect,
}: MessagesConversationRowProps) {
  const secondaryLabel = getSecondaryLabel(conversation);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "hover:bg-muted/70 flex w-full gap-3 px-3 py-3 text-left transition-colors",
        selected && "bg-primary/10 hover:bg-primary/10",
      )}
    >
      <Avatar className="mt-0.5" size="default">
        <AvatarFallback>{getInitials(conversation.title || conversation.contact)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-semibold tracking-tight">{conversation.title}</p>
          <time className="text-muted-foreground shrink-0 text-[11px]">
            {formatTime(conversation.timestamp)}
          </time>
        </div>
        {secondaryLabel ? (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">{secondaryLabel}</p>
        ) : null}
        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-5">
          {conversation.latestMessage}
        </p>
        <div className="text-muted-foreground mt-2 flex items-center gap-2 text-[11px]">
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
