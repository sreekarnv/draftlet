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
    <article className="bg-card text-card-foreground min-w-0 rounded-xl border shadow-sm">
      <header className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Mail className="text-muted-foreground size-4 shrink-0" />
            <p className="truncate text-sm font-semibold">{message.author}</p>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">{getMessageLabel(message)}</p>
        </div>
        <time className="text-muted-foreground shrink-0 text-xs">
          {formatDateTime(message.timestamp)}
        </time>
      </header>
      <div className="px-5 py-5">
        <ReplyQuote
          target={replyTarget}
          unresolvedExternalId={!replyTarget ? message.replyToExternalMessageId : undefined}
        />
        <p className="text-foreground/90 text-sm leading-7 break-words whitespace-pre-wrap">
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
              <pre className="bg-muted/60 text-muted-foreground mt-3 overflow-x-auto rounded-lg p-3 text-xs leading-5 break-words whitespace-pre-wrap">
                {quotedBody}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
