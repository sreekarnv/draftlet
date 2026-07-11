import { Conversation } from "@/lib/contracts";
import { conversationStateText } from "../utils";
import { cn } from "@/shared/lib/utils";

export interface ConversationRowProps {
  conversation: Conversation;
  selected: boolean;
  onSelect: () => void;
}

export function ConversationRow({ conversation, selected, onSelect }: ConversationRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative w-full px-4 py-3 text-left transition-colors hover:bg-muted/60",
        selected &&
          "bg-primary/10 before:absolute before:left-0 before:top-3 before:h-[calc(100%-1.5rem)] before:w-0.5 before:rounded-full before:bg-primary",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2 text-[11px] leading-4 text-muted-foreground">
            <span>{conversation.connector}</span>
            <span>·</span>
            <span>{conversation.contact}</span>
          </div>
          <p className="truncate text-sm font-semibold tracking-tight">{conversation.title}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {conversation.latestMessage}
          </p>
          <p className="mt-2 truncate text-[11px] text-muted-foreground">
            {conversationStateText(conversation).join(" · ")}
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{conversation.timestamp}</span>
      </div>
    </button>
  );
}
