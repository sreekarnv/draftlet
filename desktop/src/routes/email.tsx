import { Link, Navigate, useParams } from "react-router";

import { EmptyState } from "@/components/empty-state";
import { ConversationAiPanel } from "@/modules/conversation-detail/components/conversation-ai-panel";
import { ConversationHeader } from "@/modules/conversation-detail/components/conversation-header";
import { MessageTimeline } from "@/modules/conversation-detail/components/message-timeline";
import { useMarkConversationCaptured } from "@/modules/conversation-detail/hooks/use-mark-conversation-captured";
import { InlineDraftEditor } from "@/modules/drafting/inline-draft-editor";
import type { Conversation } from "@/lib/contracts";
import { useConversationsQuery } from "@/lib/queries/conversations";
import { useDraftsQuery, useGenerateDraft } from "@/lib/queries/drafts";
import { MissingResourceState } from "@/shared/components/missing-resource-state";
import { Button } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";

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
      <main className="bg-background h-full min-h-0 overflow-auto px-6 py-8">
        <div className="mx-auto w-full max-w-5xl space-y-4">
          <div className="bg-muted/60 h-28 rounded-2xl" />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="bg-muted/40 h-96 rounded-2xl" />
            <div className="bg-muted/40 h-80 rounded-2xl" />
          </div>
        </div>
      </main>
    );
  }

  if (emailConversations.length === 0) {
    return (
      <section className="bg-background flex h-full items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <EmptyState
            title="No Gmail threads captured yet"
            description="Gmail conversations captured by the browser extension will appear here for review and local draft generation."
          />
          <Button asChild size="sm">
            <Link to="/connectors">Open Connectors</Link>
          </Button>
        </div>
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
    <main className="bg-background flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <ConversationHeader
        variant="compact"
        className="xl:hidden"
        conversation={conversation}
        latestDraft={latestDraft}
        isGenerating={generateDraft.isPending}
        onGenerate={() => void handleGenerate()}
        onCopyLatest={handleCopyLatest}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ScrollArea className="min-h-0 flex-1 overflow-hidden">
            <div className="px-4 py-5 sm:px-6">
              <div className="bg-muted/20 rounded-2xl border px-3 py-4 sm:px-5 sm:py-6">
                <MessageTimeline conversation={conversation} messages={conversation.messages} />
              </div>
              <div className="mt-5 xl:hidden">
                <ConversationAiPanel conversation={conversation} latestDraft={latestDraft} />
              </div>
            </div>
          </ScrollArea>
          <div className="bg-background/95 shrink-0 border-t px-4 py-3 shadow-[0_-8px_20px_rgba(0,0,0,0.03)] sm:px-6">
            <InlineDraftEditor conversation={conversation} latestDraft={latestDraft} />
          </div>
        </section>

        <aside className="bg-muted/10 hidden w-[380px] shrink-0 border-l xl:flex xl:min-h-0 xl:flex-col">
          <ScrollArea className="min-h-0 flex-1 overflow-hidden">
            <div className="space-y-4 p-4">
              <ConversationHeader
                variant="rail"
                conversation={conversation}
                latestDraft={latestDraft}
                isGenerating={generateDraft.isPending}
                onGenerate={() => void handleGenerate()}
                onCopyLatest={handleCopyLatest}
              />
              <ConversationAiPanel conversation={conversation} latestDraft={latestDraft} />
            </div>
          </ScrollArea>
        </aside>
      </div>
    </main>
  );
}
