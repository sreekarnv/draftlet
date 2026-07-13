import { Bot, ShieldCheck } from "lucide-react";

import type { Conversation, Draft } from "@/lib/contracts";
import { getDraftReplyTarget, getDraftStateLabel } from "@/modules/conversation-detail/utils";
import { Button } from "@/shared/components/ui/button";

export interface ConversationDraftDockProps {
  conversation: Conversation;
  latestDraft?: Draft;
  isGenerating: boolean;
  onGenerate: () => void;
}

export function ConversationDraftDock({
  conversation,
  latestDraft,
  isGenerating,
  onGenerate,
}: ConversationDraftDockProps) {
  const replyTarget = getDraftReplyTarget(latestDraft, conversation);

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Bot className="size-4 text-primary" />
            {getDraftStateLabel(latestDraft)}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {replyTarget
              ? `Replying to ${replyTarget.author}: ${replyTarget.body}`
              : "Generate a local draft from this thread and edit it inline."}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Insert locally does not send externally. Supported external sends require confirmation.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {!latestDraft ? (
            <Button size="sm" onClick={onGenerate} disabled={isGenerating}>
              {isGenerating ? "Drafting..." : "Draft reply"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
