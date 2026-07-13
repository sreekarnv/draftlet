import { Navigate, useParams } from "react-router";

import { EmptyState } from "@/components/empty-state";
import { ConversationAiPanel } from "@/modules/conversation-detail/components/conversation-ai-panel";
import { ConversationHeader } from "@/modules/conversation-detail/components/conversation-header";
import { ConversationWorkspaceLayout } from "@/modules/conversation-detail/components/conversation-workspace-layout";
import { MessageTimeline } from "@/modules/conversation-detail/components/message-timeline";
import { useMarkConversationCaptured } from "@/modules/conversation-detail/hooks/use-mark-conversation-captured";
import { InlineDraftEditor } from "@/modules/drafting/inline-draft-editor";
import type { Conversation } from "@/lib/contracts";
import { useConversationsQuery } from "@/lib/queries/conversations";
import { useDraftsQuery, useGenerateDraft } from "@/lib/queries/drafts";
import { MissingResourceState } from "@/shared/components/missing-resource-state";

function isEmailConversation(conversation: Conversation) {
  return conversation.connector === "gmail" || conversation.threadKind === "email";
}

export function Email() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const conversationsQuery = useConversationsQuery();
  const draftsQuery = useDraftsQuery();
  const generateDraft = useGenerateDraft();

  const emailConversations = (conversationsQuery.data ?? []).filter(isEmailConversation);
  const selectedConversation = emailConversations.find(
    (conversation) => conversation.id === conversationId,
  );

  useMarkConversationCaptured(selectedConversation?.id, selectedConversation?.recentlyCaptured);

  if (conversationsQuery.isLoading || draftsQuery.isLoading) {
    return (
      <main className="min-h-full bg-background px-6 py-8">
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

  if (emailConversations.length === 0) {
    return (
      <section className="flex h-full items-center justify-center bg-background p-6">
        <EmptyState
          title="No email threads yet"
          description="Gmail conversations captured locally will appear here for review and drafting."
        />
      </section>
    );
  }

  if (!conversationId) {
    return <Navigate to={`/email/${emailConversations[0].id}`} replace />;
  }

  if (!selectedConversation) {
    return (
      <MissingResourceState
        title="Email thread not found"
        description="The selected Gmail conversation is no longer in local memory."
      />
    );
  }

  const conversation = selectedConversation;
  const latestDraft = draftsQuery.data?.find((draft) => draft.id === conversation.latestDraftId);

  function handleCopyLatest() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(conversation.latestMessage);
    }
  }

  async function handleGenerate() {
    await generateDraft.mutateAsync({ conversationId: conversation.id });
  }

  return (
    <main className="min-h-full overflow-auto bg-background">
      <ConversationHeader
        conversation={conversation}
        latestDraft={latestDraft}
        isGenerating={generateDraft.isPending}
        onGenerate={() => void handleGenerate()}
        onCopyLatest={handleCopyLatest}
      />
      <ConversationWorkspaceLayout
        thread={<MessageTimeline conversation={conversation} messages={conversation.messages} />}
        panel={<ConversationAiPanel conversation={conversation} latestDraft={latestDraft} />}
        dock={<InlineDraftEditor conversation={conversation} latestDraft={latestDraft} />}
      />
    </main>
  );
}
