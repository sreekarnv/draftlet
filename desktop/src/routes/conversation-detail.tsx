import { useParams } from "react-router";

import { ConversationAiPanel } from "@/modules/conversation-detail/components/conversation-ai-panel";
import { ConversationHeader } from "@/modules/conversation-detail/components/conversation-header";
import { ConversationWorkspaceLayout } from "@/modules/conversation-detail/components/conversation-workspace-layout";
import { MessageTimeline } from "@/modules/conversation-detail/components/message-timeline";
import { useMarkConversationCaptured } from "@/modules/conversation-detail/hooks/use-mark-conversation-captured";
import { InlineDraftEditor } from "@/modules/drafting/inline-draft-editor";
import { useConversationQuery } from "@/lib/queries/conversations";
import { useDraftsQuery, useGenerateDraft } from "@/lib/queries/drafts";
import { MissingResourceState } from "@/shared/components/missing-resource-state";

export function ConversationDetail() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const conversationQuery = useConversationQuery(conversationId);
  const conversation = conversationQuery.data;
  const draftsQuery = useDraftsQuery();
  const generateDraft = useGenerateDraft();

  useMarkConversationCaptured(conversation?.id, conversation?.recentlyCaptured);

  if (conversationQuery.isLoading || draftsQuery.isLoading) {
    return (
      <main className="h-full min-h-0 overflow-auto bg-background px-6 py-8">
        <div className="mx-auto w-full max-w-5xl space-y-4">
          <div className="h-28 rounded-2xl bg-muted/60" />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="h-96 rounded-2xl bg-muted/40" />
            <div className="h-80 rounded-2xl bg-muted/40" />
          </div>
        </div>
      </main>
    );
  }

  if (!conversation) {
    return (
      <MissingResourceState
        title="Conversation not found"
        description="The selected conversation is no longer in local memory."
      />
    );
  }

  const selectedConversation = conversation;
  const latestDraft = draftsQuery.data?.find((draft) => draft.id === conversation.latestDraftId);

  async function handleGenerate() {
    await generateDraft.mutateAsync({ conversationId: selectedConversation.id });
  }

  function handleCopyLatest() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(selectedConversation.latestMessage);
    }
  }

  return (
    <main className="h-full min-h-0 overflow-auto bg-background">
      <ConversationHeader
        conversation={selectedConversation}
        latestDraft={latestDraft}
        isGenerating={generateDraft.isPending}
        onGenerate={() => void handleGenerate()}
        onCopyLatest={handleCopyLatest}
      />
      <ConversationWorkspaceLayout
        thread={
          <MessageTimeline
            conversation={selectedConversation}
            messages={selectedConversation.messages}
          />
        }
        panel={
          <ConversationAiPanel conversation={selectedConversation} latestDraft={latestDraft} />
        }
        dock={<InlineDraftEditor conversation={selectedConversation} latestDraft={latestDraft} />}
      />
    </main>
  );
}
