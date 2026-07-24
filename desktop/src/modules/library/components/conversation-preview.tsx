import { EmptyState } from "@/components/empty-state";
import { type Conversation } from "@/lib/contracts";
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
      <aside className="bg-muted/50 hidden min-h-0 lg:flex lg:w-100 lg:flex-col">
        <EmptyState
          title="No conversation selected"
          description="Select a captured conversation to preview its connector metadata and latest message."
        />
      </aside>
    );
  }

  return (
    <aside className="bg-muted/50 text-card-foreground hidden min-h-0 lg:flex lg:w-100 lg:flex-col">
      <div className="p-5">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
          Preview
        </p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight">{conversation.title}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {conversation.connector} · {conversation.contact}
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 px-5 pb-5">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
              Participants
            </p>
            <p className="mt-2 text-sm leading-6">{conversation.participants}</p>
          </div>

          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
              Source
            </p>
            <p className="mt-2 text-sm leading-6">{conversation.source}</p>
          </div>

          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
              Useful context
            </p>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              {conversation.latestMessage}
            </p>
          </div>

          <div>
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-[0.14em] uppercase">
              State
            </p>
            <p className="text-muted-foreground text-sm leading-6">
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
