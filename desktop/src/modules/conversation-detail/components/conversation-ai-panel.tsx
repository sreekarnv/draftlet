import { Bot, Database, LockKeyhole, MessagesSquare } from "lucide-react";

import { StatusBadge } from "@/components/status-dot";
import type { Conversation, Draft } from "@/lib/contracts";
import {
  getDraftReplyTarget,
  getDraftStateLabel,
  getSendModeLabel,
} from "@/modules/conversation-detail/utils";

export interface ConversationAiPanelProps {
  conversation: Conversation;
  latestDraft?: Draft;
}

export function ConversationAiPanel({ conversation, latestDraft }: ConversationAiPanelProps) {
  const replyTarget = getDraftReplyTarget(latestDraft, conversation);
  const selectedMessages = latestDraft?.selectedMessages ?? [];

  return (
    <div className="bg-card text-card-foreground rounded-2xl border p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-full">
          <Bot className="size-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">Draftlet memory</p>
          <p className="text-muted-foreground text-xs">Local AI drafting context</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <section className="bg-muted/40 rounded-xl p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <LockKeyhole className="text-muted-foreground size-3.5" />
            {getDraftStateLabel(latestDraft)}
          </div>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            Drafts are generated and edited inline. Insert locally when you want a Draftlet-only
            timeline entry, or explicitly confirm a supported external send.
          </p>
        </section>

        <section>
          <p className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-medium tracking-[0.14em] uppercase">
            <MessagesSquare className="size-3.5" />
            Reply target
          </p>
          {replyTarget ? (
            <div className="bg-background rounded-lg border p-3">
              <p className="text-sm font-medium">{replyTarget.author}</p>
              <p className="text-muted-foreground mt-1 line-clamp-3 text-xs leading-5">
                {replyTarget.body}
              </p>
              <div className="mt-2">
                <StatusBadge tone="ready">{getSendModeLabel(latestDraft?.sendMode)}</StatusBadge>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-xs leading-5">
              No draft reply target yet. Draftlet will target the latest incoming message when you
              draft a reply.
            </p>
          )}
        </section>

        <section>
          <p className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-medium tracking-[0.14em] uppercase">
            <Database className="size-3.5" />
            Context snapshot
          </p>
          {selectedMessages.length > 0 ? (
            <div className="space-y-2">
              {selectedMessages.slice(0, 3).map((message, index) => (
                <div key={`${message.author}-${index}`} className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs font-medium">{message.author}</p>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-5">
                    {message.detail}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-xs leading-5">
              No saved draft context. The next draft will use recent messages from this thread.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
