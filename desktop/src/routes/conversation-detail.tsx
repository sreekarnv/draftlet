import { useNavigate, useParams } from "react-router";

import { ConversationHeader } from "@/modules/conversation-detail/components/conversation-header";
import { MessageTimeline } from "@/modules/conversation-detail/components/message-timeline";
import { useMarkConversationCaptured } from "@/modules/conversation-detail/hooks/use-mark-conversation-captured";
import { useConversationQuery } from "@/lib/queries/conversations";
import { useGenerateDraft } from "@/lib/queries/drafts";
import { MissingResourceState } from "@/shared/components/missing-resource-state";

export function ConversationDetail() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const conversation = useConversationQuery(conversationId).data;
  const generateDraft = useGenerateDraft();
  const navigate = useNavigate();

  useMarkConversationCaptured(conversation?.id, conversation?.recentlyCaptured);

  if (!conversation) {
    return (
      <MissingResourceState
        title="Conversation not found"
        description="The selected conversation is no longer in local memory."
      />
    );
  }

  const selectedConversation = conversation;

  async function handleGenerate() {
    const draft = await generateDraft.mutateAsync({ conversationId: selectedConversation.id });
    void navigate(`/drafts/${draft.id}`);
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
        onGenerate={() => void handleGenerate()}
        onCopyLatest={handleCopyLatest}
      />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-8">
        <MessageTimeline messages={selectedConversation.messages} />
      </div>
    </main>
  );
}
