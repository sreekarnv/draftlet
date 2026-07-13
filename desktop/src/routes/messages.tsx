import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { EmptyState } from "@/components/empty-state";
import { useConversationsQuery } from "@/lib/queries/conversations";
import { useDraftsQuery, useGenerateDraft } from "@/lib/queries/drafts";
import { MessagesChatList } from "@/modules/messages/components/messages-chat-list";
import { MessagesWorkspace } from "@/modules/messages/components/messages-workspace";

export function Messages() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const conversationsQuery = useConversationsQuery();
  const draftsQuery = useDraftsQuery();
  const generateDraft = useGenerateDraft();
  const [query, setQuery] = useState("");

  const chatConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (conversationsQuery.data ?? []).filter((conversation) => {
      const isChat = conversation.connector === "telegram" || conversation.threadKind === "chat";
      if (!isChat) return false;
      if (!normalizedQuery) return true;
      return [
        conversation.title,
        conversation.contact,
        conversation.participants,
        conversation.latestMessage,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [conversationsQuery.data, query]);
  const selectedConversation =
    chatConversations.find((conversation) => conversation.id === conversationId) ??
    chatConversations[0];
  const latestDraft = draftsQuery.data?.find(
    (draft) => draft.id === selectedConversation?.latestDraftId,
  );

  async function handleGenerate() {
    if (!selectedConversation) return;
    await generateDraft.mutateAsync({ conversationId: selectedConversation.id });
  }

  function handleCopyLatest() {
    if (selectedConversation && typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(selectedConversation.latestMessage);
    }
  }

  if (conversationsQuery.isLoading || draftsQuery.isLoading) {
    return (
      <section className="grid h-full min-h-0 overflow-hidden bg-background lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="hidden border-r bg-muted/30 p-4 lg:block">
          <div className="h-10 rounded-lg bg-muted" />
          <div className="mt-4 space-y-3">
            <div className="h-20 rounded-xl bg-muted" />
            <div className="h-20 rounded-xl bg-muted" />
            <div className="h-20 rounded-xl bg-muted" />
          </div>
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden p-4">
          <div className="h-16 shrink-0 rounded-xl bg-muted/70" />
          <div className="mt-4 min-h-0 flex-1 rounded-xl bg-muted/40" />
          <div className="mt-4 h-20 shrink-0 rounded-xl bg-muted/70" />
        </div>
      </section>
    );
  }

  return (
    <section className="grid h-full min-h-0 overflow-hidden bg-background lg:grid-cols-[340px_minmax(0,1fr)]">
      <MessagesChatList
        conversations={chatConversations}
        selectedConversationId={selectedConversation?.id}
        query={query}
        onQueryChange={setQuery}
        onSelectConversation={(id) => void navigate(`/messages/${id}`)}
        hiddenOnMobile={Boolean(conversationId)}
      />

      <div
        className={
          conversationId
            ? "h-full min-h-0 overflow-hidden"
            : "hidden h-full min-h-0 overflow-hidden lg:block"
        }
      >
        {selectedConversation ? (
          <MessagesWorkspace
            conversation={selectedConversation}
            latestDraft={latestDraft}
            isGenerating={generateDraft.isPending}
            onGenerate={() => void handleGenerate()}
            onCopyLatest={handleCopyLatest}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <EmptyState
              title="Select a message thread"
              description="Draftlet will show your local chat history, reply target, and drafting context here."
            />
          </div>
        )}
      </div>
    </section>
  );
}
