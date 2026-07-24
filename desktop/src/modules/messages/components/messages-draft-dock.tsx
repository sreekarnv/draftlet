import { Bot, ShieldCheck } from "lucide-react";

import type { Conversation, Draft } from "@/lib/contracts";
import { getDraftReplyTarget, getDraftStateLabel } from "@/modules/conversation-detail/utils";
import { Button } from "@/shared/components/ui/button";

export interface MessagesDraftDockProps {
  conversation: Conversation;
  latestDraft?: Draft;
  isGenerating: boolean;
  onGenerate: () => void;
}

export function MessagesDraftDock({
  conversation,
  latestDraft,
  isGenerating,
  onGenerate,
}: MessagesDraftDockProps) {
  const replyTarget = getDraftReplyTarget(latestDraft, conversation);

  return (
    <footer className="bg-background/95 shrink-0 border-t p-3">
      <div className="bg-card rounded-xl border px-3 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="text-primary size-4" />
              {getDraftStateLabel(latestDraft)}
            </div>
            <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
              {replyTarget
                ? `Replying to ${replyTarget.author}: ${replyTarget.body}`
                : "Generate a local draft from this thread."}
            </p>
            <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-[11px]">
              <ShieldCheck className="size-3.5" />
              Draft inline here. Insert locally does not send externally.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {!latestDraft ? (
              <Button size="sm" onClick={onGenerate} disabled={isGenerating}>
                {isGenerating ? "Drafting..." : "Draft reply"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
