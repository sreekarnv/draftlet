import { Copy } from "lucide-react";
import { Link } from "react-router";

import { ConnectorBadge } from "@/components/connector-badge";
import { StatusBadge } from "@/components/status-dot";
import type { Conversation, Draft } from "@/lib/contracts";
import {
  formatDateTime,
  getDraftStateLabel,
  getThreadViewKind,
} from "@/modules/conversation-detail/utils";
import { Button } from "@/shared/components/ui/button";

export interface ConversationHeaderProps {
  conversation: Conversation;
  latestDraft?: Draft;
  isGenerating: boolean;
  onGenerate: () => void;
  onCopyLatest: () => void;
}

export function ConversationHeader({
  conversation,
  latestDraft,
  isGenerating,
  onGenerate,
  onCopyLatest,
}: ConversationHeaderProps) {
  const hasAccepted = conversation.messages.some((message) => message.kind === "accepted");
  const hasDraft = Boolean(latestDraft);
  const hasSent = conversation.messages.some((message) => message.kind === "outgoing");
  const threadKind = getThreadViewKind(conversation);
  const threadLabel =
    threadKind === "chat" ? "Chat thread" : threadKind === "email" ? "Email thread" : "Timeline";

  return (
    <div className="border-b bg-background/95 px-6 py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ConnectorBadge connector={conversation.connector} status="ready" />
            <StatusBadge tone="ready">{threadLabel}</StatusBadge>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{conversation.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            <span>{conversation.participants || conversation.contact}</span>
            <span aria-hidden>·</span>
            <span>{conversation.messages.length} messages</span>
            <span aria-hidden>·</span>
            <span>Captured {formatDateTime(conversation.capturedAt)}</span>
            {conversation.externalThreadId ? <span aria-hidden>·</span> : null}
            {conversation.externalThreadId ? (
              <span>Thread {conversation.externalThreadId}</span>
            ) : null}
          </p>
          <p className="mt-2 max-w-2xl truncate text-sm text-muted-foreground">
            Latest: {conversation.latestMessage}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <StatusBadge tone="ready">Local capture</StatusBadge>
            {hasDraft ? (
              <StatusBadge tone="generating">{getDraftStateLabel(latestDraft)}</StatusBadge>
            ) : null}
            {hasAccepted ? <StatusBadge tone="ready">Inserted reply</StatusBadge> : null}
            {hasSent ? <StatusBadge tone="ready">Sent externally</StatusBadge> : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {latestDraft ? (
            <Button size="sm" asChild>
              <Link to={`/drafts/${latestDraft.id}`}>Open draft</Link>
            </Button>
          ) : (
            <Button size="sm" onClick={onGenerate} disabled={isGenerating}>
              {isGenerating ? "Drafting..." : "Draft reply"}
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
