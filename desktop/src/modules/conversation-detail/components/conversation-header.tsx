import { Copy } from "lucide-react";

import { ConnectorBadge } from "@/components/connector-badge";
import { StatusBadge } from "@/components/status-dot";
import type { Conversation, Draft } from "@/lib/contracts";
import {
  formatDateTime,
  getDraftStateLabel,
  getThreadViewKind,
} from "@/modules/conversation-detail/utils";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

type ConversationHeaderVariant = "page" | "compact" | "rail";

export interface ConversationHeaderProps {
  conversation: Conversation;
  latestDraft?: Draft;
  isGenerating: boolean;
  onGenerate: () => void;
  onCopyLatest: () => void;
  variant?: ConversationHeaderVariant;
  className?: string;
}

export function ConversationHeader({
  conversation,
  latestDraft,
  isGenerating,
  onGenerate,
  onCopyLatest,
  variant = "page",
  className,
}: ConversationHeaderProps) {
  const hasAccepted = conversation.messages.some((message) => message.kind === "accepted");
  const hasDraft = Boolean(latestDraft);
  const hasSent = conversation.messages.some((message) => message.kind === "outgoing");
  const threadKind = getThreadViewKind(conversation);
  const threadLabel =
    threadKind === "chat" ? "Chat thread" : threadKind === "email" ? "Email thread" : "Timeline";

  const isRail = variant === "rail";
  const isCompact = variant === "compact";

  return (
    <div
      className={cn(
        variant === "page" && "bg-background/95 border-b px-6 py-6",
        isCompact && "bg-background/95 shrink-0 border-b px-4 py-3 sm:px-6",
        isRail && "bg-card text-card-foreground rounded-2xl border p-4 shadow-sm",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col gap-4",
          variant === "page" && "mx-auto max-w-5xl lg:flex-row lg:items-start lg:justify-between",
          isCompact && "sm:flex-row sm:items-start sm:justify-between",
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ConnectorBadge connector={conversation.connector} status="ready" />
            <StatusBadge tone="ready">{threadLabel}</StatusBadge>
          </div>
          <h1
            className={cn(
              "mt-3 font-semibold tracking-[-0.03em]",
              isRail ? "text-base leading-6" : isCompact ? "text-lg" : "text-2xl",
            )}
          >
            {conversation.title}
          </h1>
          <p
            className={cn(
              "text-muted-foreground mt-2 flex flex-wrap items-center gap-x-1.5",
              isRail || isCompact ? "text-xs" : "text-sm",
            )}
          >
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
          <p
            className={cn(
              "text-muted-foreground mt-2",
              isRail ? "line-clamp-3 text-xs leading-5" : "max-w-2xl truncate text-sm",
            )}
          >
            Latest: {conversation.latestMessage}
          </p>
          <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <StatusBadge tone="ready">Local capture</StatusBadge>
            {hasDraft ? (
              <StatusBadge tone="generating">{getDraftStateLabel(latestDraft)}</StatusBadge>
            ) : null}
            {hasAccepted ? <StatusBadge tone="ready">Inserted reply</StatusBadge> : null}
            {hasSent ? <StatusBadge tone="ready">Sent externally</StatusBadge> : null}
          </div>
        </div>

        <div className={cn("flex shrink-0 gap-2", isRail ? "flex-col" : "flex-wrap")}>
          {!latestDraft ? (
            <Button
              size="sm"
              className={cn(isRail && "w-full")}
              onClick={onGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? "Drafting..." : "Draft reply"}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className={cn(isRail && "w-full")}
            onClick={onCopyLatest}
          >
            <Copy className="size-3.5" />
            Copy latest
          </Button>
        </div>
      </div>
    </div>
  );
}
