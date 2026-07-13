import { MessageCircle, Search } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import type { Conversation } from "@/lib/contracts";
import { MessagesConversationRow } from "@/modules/messages/components/messages-conversation-row";
import { Input } from "@/shared/components/ui/input";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { cn } from "@/shared/lib/utils";

export interface MessagesChatListProps {
  conversations: Conversation[];
  selectedConversationId?: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSelectConversation: (id: string) => void;
  hiddenOnMobile?: boolean;
}

export function MessagesChatList({
  conversations,
  selectedConversationId,
  query,
  onQueryChange,
  onSelectConversation,
  hiddenOnMobile = false,
}: MessagesChatListProps) {
  return (
    <aside
      className={cn(
        "min-h-0 flex-col border-r bg-muted/30 lg:flex",
        hiddenOnMobile ? "hidden" : "flex",
      )}
    >
      <div className="shrink-0 border-b bg-background/80 p-4">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageCircle className="size-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">Messages</h1>
            <p className="text-xs text-muted-foreground">Local texting companion</p>
          </div>
        </div>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search chats"
            className="pl-8"
          />
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {conversations.length > 0 ? (
          <div className="divide-y divide-border/60">
            {conversations.map((conversation) => (
              <MessagesConversationRow
                key={conversation.id}
                conversation={conversation}
                selected={conversation.id === selectedConversationId}
                onSelect={() => onSelectConversation(conversation.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No message threads yet"
            description="Connect Telegram and captured chats will appear here as local message threads."
          />
        )}
      </ScrollArea>
    </aside>
  );
}
