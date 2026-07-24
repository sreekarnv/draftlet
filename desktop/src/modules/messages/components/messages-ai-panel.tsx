import type { Conversation, Draft } from "@/lib/contracts";
import { ConversationAiPanel } from "@/modules/conversation-detail/components/conversation-ai-panel";
import { ScrollArea } from "@/shared/components/ui/scroll-area";

export function MessagesAiPanel({
  conversation,
  latestDraft,
}: {
  conversation: Conversation;
  latestDraft?: Draft;
}) {
  return (
    <aside className="bg-muted/20 hidden w-[340px] shrink-0 border-l xl:flex xl:min-h-0 xl:flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          <ConversationAiPanel conversation={conversation} latestDraft={latestDraft} />
        </div>
      </ScrollArea>
    </aside>
  );
}
