import { EmptyState } from "@/components/empty-state";
import { Conversation } from "@/lib/contracts";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { conversationStateText } from "@/modules/library/utils";
import { Button } from "@/shared/components/ui/button";
import { Link } from "react-router";

export interface ConversationPreviewProps {
  conversation?: Conversation;
  onGenerate: (id: string) => void;
}

export function ConversationPreview({ conversation, onGenerate }: ConversationPreviewProps) {
  if (!conversation) {
    return (
      <aside className="hidden min-h-0 bg-muted/50 lg:flex lg:w-[400px] lg:flex-col">
        <EmptyState
          title="No conversation selected"
          description="Select a captured conversation to preview its connector metadata and latest message."
        />
      </aside>
    );
  }

  return (
    <aside className="hidden min-h-0 bg-muted/50 text-card-foreground lg:flex lg:w-[400px] lg:flex-col">
      <div className="p-5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Preview
        </p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight">{conversation.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {conversation.connector} · {conversation.contact}
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 px-5 pb-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Participants
            </p>
            <p className="mt-2 text-sm leading-6">{conversation.participants}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Source
            </p>
            <p className="mt-2 text-sm leading-6">{conversation.source}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Useful context
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {conversation.latestMessage}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              State
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              {conversationStateText(conversation).join(" · ") || "No active state"}
            </p>
          </div>
        </div>
      </ScrollArea>

      <div className="p-3">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link to={`/library/${conversation.id}`}>Open Conversation</Link>
          </Button>
          {!conversation.latestDraftId ? (
            <Button size="sm" onClick={() => onGenerate(conversation.id)}>
              Generate Follow-up
            </Button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
