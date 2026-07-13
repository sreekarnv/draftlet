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
    <div className="rounded-2xl border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="size-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">Draftlet memory</p>
          <p className="text-xs text-muted-foreground">Local AI drafting context</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <section className="rounded-xl bg-muted/40 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <LockKeyhole className="size-3.5 text-muted-foreground" />
            {getDraftStateLabel(latestDraft)}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Drafts are generated locally. Opening the draft workspace is required before inserting
            or sending.
          </p>
        </section>

        <section>
          <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <MessagesSquare className="size-3.5" />
            Reply target
          </p>
          {replyTarget ? (
            <div className="rounded-lg border bg-background p-3">
              <p className="text-sm font-medium">{replyTarget.author}</p>
              <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
                {replyTarget.body}
              </p>
              <div className="mt-2">
                <StatusBadge tone="ready">{getSendModeLabel(latestDraft?.sendMode)}</StatusBadge>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-3 text-xs leading-5 text-muted-foreground">
              No draft reply target yet. Draftlet will target the latest incoming message when you
              draft a reply.
            </p>
          )}
        </section>

        <section>
          <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <Database className="size-3.5" />
            Context snapshot
          </p>
          {selectedMessages.length > 0 ? (
            <div className="space-y-2">
              {selectedMessages.slice(0, 3).map((message, index) => (
                <div key={`${message.author}-${index}`} className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs font-medium">{message.author}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {message.detail}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-3 text-xs leading-5 text-muted-foreground">
              No saved draft context. The next draft will use recent messages from this thread.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
