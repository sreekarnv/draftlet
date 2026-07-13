import { ChevronDown, Mail } from "lucide-react";
import { useState } from "react";

import type { Message } from "@/lib/contracts";
import { Button } from "@/shared/components/ui/button";
import { ReplyQuote } from "@/modules/conversation-detail/components/reply-quote";
import {
  formatDateTime,
  getMessageLabel,
  splitQuotedEmailContent,
} from "@/modules/conversation-detail/utils";

export interface EmailMessageCardProps {
  message: Message;
  replyTarget?: Message;
}

export function EmailMessageCard({ message, replyTarget }: EmailMessageCardProps) {
  const [showQuote, setShowQuote] = useState(false);
  const { visibleBody, quotedBody } = splitQuotedEmailContent(message.body);
  const hasQuote = quotedBody.length > 0;

  return (
    <article className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <header className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Mail className="size-4 shrink-0 text-muted-foreground" />
            <p className="truncate text-sm font-semibold">{message.author}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{getMessageLabel(message)}</p>
        </div>
        <time className="shrink-0 text-xs text-muted-foreground">
          {formatDateTime(message.timestamp)}
        </time>
      </header>
      <div className="px-5 py-5">
        <ReplyQuote
          target={replyTarget}
          unresolvedExternalId={!replyTarget ? message.replyToExternalMessageId : undefined}
        />
        <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">
          {visibleBody || message.body}
        </p>
        {hasQuote ? (
          <div className="mt-4">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => setShowQuote(!showQuote)}
            >
              <ChevronDown className="size-3.5" />
              {showQuote ? "Hide quoted text" : "Show quoted text"}
            </Button>
            {showQuote ? (
              <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
                {quotedBody}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
