import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { Link } from "react-router";

import { ConnectorBadge } from "@/components/connector-badge";
import { StatusBadge } from "@/components/status-dot";
import type { Conversation, Draft } from "@/lib/contracts";
import { getDraftStateLabel, getInitials } from "@/modules/conversation-detail/utils";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";

export interface MessagesConversationHeaderProps {
  conversation: Conversation;
  latestDraft?: Draft;
  isGenerating: boolean;
  onGenerate: () => void;
  onCopyLatest: () => void;
}

export function MessagesConversationHeader({
  conversation,
  latestDraft,
  isGenerating,
  onGenerate,
  onCopyLatest,
}: MessagesConversationHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-background/95 px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" asChild>
          <Link to="/messages" aria-label="Back to messages">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <Avatar>
          <AvatarFallback>{getInitials(conversation.title || conversation.contact)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight">{conversation.title}</h2>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <ConnectorBadge connector={conversation.connector} status="ready" />
            <span className="truncate">{conversation.messages.length} messages</span>
            {latestDraft ? (
              <StatusBadge tone="generating">{getDraftStateLabel(latestDraft)}</StatusBadge>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={onCopyLatest}>
          <Copy className="size-3.5" />
          Copy latest
        </Button>
        {latestDraft ? (
          <Button size="sm" asChild>
            <Link to={`/drafts/${latestDraft.id}`}>
              Open draft
              <ExternalLink className="size-3.5" />
            </Link>
          </Button>
        ) : (
          <Button size="sm" onClick={onGenerate} disabled={isGenerating}>
            {isGenerating ? "Drafting..." : "Draft reply"}
          </Button>
        )}
      </div>
    </header>
  );
}
