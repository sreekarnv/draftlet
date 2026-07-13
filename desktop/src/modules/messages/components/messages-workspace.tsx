import type { Conversation, Draft } from "@/lib/contracts";
import { MessageTimeline } from "@/modules/conversation-detail/components/message-timeline";
import { MessagesAiPanel } from "@/modules/messages/components/messages-ai-panel";
import { MessagesConversationHeader } from "@/modules/messages/components/messages-conversation-header";
import { MessagesDraftDock } from "@/modules/messages/components/messages-draft-dock";
import { ScrollArea } from "@/shared/components/ui/scroll-area";

export interface MessagesWorkspaceProps {
  conversation: Conversation;
  latestDraft?: Draft;
  isGenerating: boolean;
  onGenerate: () => void;
  onCopyLatest: () => void;
}

export function MessagesWorkspace({
  conversation,
  latestDraft,
  isGenerating,
  onGenerate,
  onCopyLatest,
}: MessagesWorkspaceProps) {
  return (
    <main className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <MessagesConversationHeader
        conversation={conversation}
        latestDraft={latestDraft}
        isGenerating={isGenerating}
        onGenerate={onGenerate}
        onCopyLatest={onCopyLatest}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ScrollArea className="min-h-0 flex-1">
            <div className="px-3 py-5 sm:px-5">
              <MessageTimeline conversation={conversation} messages={conversation.messages} />
            </div>
          </ScrollArea>
          <MessagesDraftDock
            conversation={conversation}
            latestDraft={latestDraft}
            isGenerating={isGenerating}
            onGenerate={onGenerate}
          />
        </section>
        <MessagesAiPanel conversation={conversation} latestDraft={latestDraft} />
      </div>
    </main>
  );
}
