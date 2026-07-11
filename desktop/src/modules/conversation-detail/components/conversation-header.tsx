import { Copy, Mail, MessageCircle } from "lucide-react";
import { Link } from "react-router";

import { StatusBadge } from "@/components/status-dot";
import type { Conversation } from "@/lib/contracts";
import { Button } from "@/shared/components/ui/button";

function connectorIcon(connector: Conversation["connector"]) {
  return connector === "Gmail" ? Mail : MessageCircle;
}

export function ConversationHeader({
  conversation,
  onGenerate,
  onCopyLatest,
}: {
  conversation: Conversation;
  onGenerate: () => void;
  onCopyLatest: () => void;
}) {
  const ConnectorIcon = connectorIcon(conversation.connector);
  const hasAccepted = conversation.messages.some((message) => message.kind === "accepted");
  const hasDraft = conversation.draftIds.length > 0;

  return (
    <div className="border-b bg-background/95 px-6 py-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">{conversation.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            <ConnectorIcon className="size-3.5 shrink-0" />
            <span>{conversation.connector}</span>
            <span aria-hidden>·</span>
            <span>{conversation.participants}</span>
            <span aria-hidden>·</span>
            <span>{conversation.source}</span>
            <span aria-hidden>·</span>
            <span>{conversation.capturedAt}</span>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <StatusBadge tone="ready">Local capture</StatusBadge>
            {hasDraft ? <StatusBadge tone="generating">Draft available</StatusBadge> : null}
            {hasAccepted ? <StatusBadge tone="ready">Inserted reply</StatusBadge> : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {conversation.latestDraftId ? (
            <Button size="sm" asChild>
              <Link to={`/drafts/${conversation.latestDraftId}`}>Open draft</Link>
            </Button>
          ) : (
            <Button size="sm" onClick={onGenerate}>
              Generate Follow-up
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onCopyLatest}>
            <Copy className="size-3.5" />
            Copy latest
          </Button>
        </div>
      </div>
    </div>
  );
}
