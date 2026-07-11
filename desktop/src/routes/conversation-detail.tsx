import { useNavigate, useParams } from "react-router";

import { ConversationHeader } from "@/modules/conversation-detail/components/conversation-header";
import { MessageTimeline } from "@/modules/conversation-detail/components/message-timeline";
import { useMarkConversationCaptured } from "@/modules/conversation-detail/hooks/use-mark-conversation-captured";
import { MissingResourceState } from "@/shared/components/missing-resource-state";
import { useDraftletStore } from "@/state/draftlet-store";

export function ConversationDetail() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const conversation = useDraftletStore((state) =>
    state.conversations.find((item) => item.id === conversationId),
  );
  const generateDraftFromConversation = useDraftletStore(
    (state) => state.generateDraftFromConversation,
  );
  const markConversationCaptured = useDraftletStore((state) => state.markConversationCaptured);
  const navigate = useNavigate();

  useMarkConversationCaptured(conversation?.id, markConversationCaptured);

  if (!conversation) {
    return (
      <MissingResourceState
        title="Conversation not found"
        description="The selected conversation is no longer in local memory."
      />
    );
  }

  const selectedConversation = conversation;

  function handleGenerate() {
    const draftId = generateDraftFromConversation(selectedConversation.id);

    if (draftId) {
      void navigate(`/drafts/${draftId}`);
    }
  }

  function handleCopyLatest() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(selectedConversation.latestMessage);
    }
  }

  return (
    <main className="min-h-full overflow-auto bg-background">
      <ConversationHeader
        conversation={selectedConversation}
        onGenerate={handleGenerate}
        onCopyLatest={handleCopyLatest}
      />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-8">
        <MessageTimeline messages={selectedConversation.messages} />
      </div>
    </main>
  );
}
