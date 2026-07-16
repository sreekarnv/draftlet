import { useMemo, useReducer } from "react";
import { useNavigate } from "react-router";
import { Search } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { EmptyState } from "@/components/empty-state";
import { useConversationsQuery } from "@/lib/queries/conversations";
import { useGenerateDraft } from "@/lib/queries/drafts";
import { useDraftletStore } from "@/state/draftlet-store";
import { LibraryFilter, LibraryTab } from "@/modules/library/types";
import { matchesFilter } from "@/modules/library/utils";
import { ConversationRow } from "@/modules/library/components/conversation-row";
import { ConversationPreview } from "@/modules/library/components/conversation-preview";
import { libraryReducer } from "@/modules/library/state";

const FILTERS: LibraryTab[] = [
  { id: LibraryFilter.ALL, label: "All" },
  { id: LibraryFilter.GMAIL, label: "Gmail" },
  { id: LibraryFilter.TELEGRAM, label: "Telegram" },
  { id: LibraryFilter.DRAFT_PENDING, label: "Draft pending" },
  { id: LibraryFilter.NEEDS_FOLLOW_UP, label: "Needs follow-up" },
  { id: LibraryFilter.RECENTLY_CAPTURED, label: "Recently captured" },
];

export function Library() {
  const navigate = useNavigate();
  const conversations = useConversationsQuery();
  const generateDraft = useGenerateDraft();
  const selectedLibraryConversationId = useDraftletStore((s) => s.selectedLibraryConversationId);
  const setSelectedLibraryConversationId = useDraftletStore(
    (s) => s.setSelectedLibraryConversationId,
  );
  const [state, dispatch] = useReducer(libraryReducer, {
    activeFilter: LibraryFilter.ALL,
    query: "",
    selectedId: selectedLibraryConversationId,
  });
  const hasSearch = state.query.trim().length > 0;
  const conversationsData = conversations.data ?? [];

  const filteredConversations = useMemo(() => {
    const normalizedQuery = state.query.trim().toLowerCase();

    return conversationsData.filter((conversation) => {
      const matchesQuery = normalizedQuery
        ? [
            conversation.title,
            conversation.contact,
            conversation.participants,
            conversation.source,
            conversation.latestMessage,
            conversation.connector,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
        : true;

      return matchesQuery && matchesFilter(conversation, state.activeFilter);
    });
  }, [state.activeFilter, conversationsData, state.query]);

  const selectedConversation =
    conversationsData.find((conversation) => conversation.id === state.selectedId) ??
    filteredConversations[0];

  async function handleGenerate(conversationId: string) {
    const newDraft = await generateDraft.mutateAsync({ conversationId });
    void navigate(`/drafts/${newDraft.id}`);
  }

  return (
    <section className="flex min-h-full bg-background">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="bg-background p-5 text-card-foreground">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Conversation Library
              </p>
              <h1 className="mt-1 text-lg font-semibold tracking-tight">Conversation memory</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {filteredConversations.length} of {conversationsData.length} local captures shown
              </p>
            </div>
            <div className="relative w-full xl:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={state.query}
                onChange={(event) => {
                  dispatch({
                    type: "set_query",
                    payload: {
                      query: event.target.value,
                    },
                  });
                }}
                placeholder="Search conversations, contacts, connectors"
                className="pl-8"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {FILTERS.map((filter) => {
              const selected = filter.id === state.activeFilter;

              return (
                <Button
                  key={filter.id}
                  type="button"
                  variant={selected ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    dispatch({
                      type: "set_active_filter",
                      payload: {
                        filter: filter.id,
                      },
                    });
                  }}
                >
                  {filter.label}
                </Button>
              );
            })}
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          {filteredConversations.length > 0 ? (
            <div className="divide-y divide-border/60">
              {filteredConversations.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  selected={conversation.id === selectedConversation?.id}
                  onSelect={() => {
                    dispatch({
                      type: "set_selected_id",
                      payload: {
                        selectedId: conversation.id,
                      },
                    });
                    setSelectedLibraryConversationId(conversation.id);
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={hasSearch ? "No search results" : "No conversations in this view"}
              description={
                hasSearch
                  ? "Try another contact, connector, phrase, or state filter."
                  : "Captured Gmail and Telegram Desktop conversations will appear here when they match this filter."
              }
            />
          )}
        </ScrollArea>
      </div>

      <ConversationPreview
        conversation={selectedConversation}
        onGenerate={(id) => void handleGenerate(id)}
      />
    </section>
  );
}
