import { type Conversation } from "@/lib/contracts";
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
        "hover:bg-muted/60 relative w-full px-4 py-3 text-left transition-colors",
        selected &&
          "bg-primary/10 before:bg-primary before:absolute before:top-3 before:left-0 before:h-[calc(100%-1.5rem)] before:w-0.5 before:rounded-full",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-muted-foreground mb-1.5 flex items-center gap-2 text-[11px] leading-4">
            <span>{conversation.connector}</span>
            <span>·</span>
            <span>{conversation.contact}</span>
          </div>
          <p className="truncate text-sm font-semibold tracking-tight">{conversation.title}</p>
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-5">
            {conversation.latestMessage}
          </p>
          <p className="text-muted-foreground mt-2 truncate text-[11px]">
            {conversationStateText(conversation).join(" · ")}
          </p>
        </div>
        <span className="text-muted-foreground shrink-0 text-xs">{conversation.timestamp}</span>
      </div>
    </button>
  );
}
