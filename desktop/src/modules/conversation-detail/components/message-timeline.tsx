import type { Conversation, Message } from "@/lib/contracts";
import { ChatThreadView } from "@/modules/conversation-detail/components/chat-thread-view";
import { EmailThreadView } from "@/modules/conversation-detail/components/email-thread-view";
import { getThreadViewKind, formatDateTime } from "@/modules/conversation-detail/utils";

function timelineKindMeta(kind: Message["kind"]) {
  switch (kind) {
    case "incoming":
      return {
        label: "Captured incoming",
        borderClass: "border-l-muted-foreground/40",
      };
    case "outgoing":
      return {
        label: "Captured outgoing",
        borderClass: "border-l-sky-500",
      };
    case "draft":
      return {
        label: "Draftlet-generated draft",
        borderClass: "border-l-sky-500",
      };
    default:
      return {
        label: "Accepted / inserted reply",
        borderClass: "border-l-emerald-500",
      };
  }
}

export interface MessageTimelineProps {
  conversation: Conversation;
  messages: Message[];
}

export function MessageTimeline({ conversation, messages }: MessageTimelineProps) {
  if (messages.length === 0) {
    return (
      <div className="bg-card text-muted-foreground rounded-md border border-dashed p-5 text-sm">
        No captured messages yet for this conversation.
      </div>
    );
  }

  const viewKind = getThreadViewKind(conversation);
  if (viewKind === "chat") {
    return <ChatThreadView messages={messages} />;
  }
  if (viewKind === "email") {
    return <EmailThreadView messages={messages} />;
  }

  return (
    <div className="space-y-6">
      {messages.map((message) => {
        const meta = timelineKindMeta(message.kind);

        return (
          <article key={message.id} className={`border-l-2 ${meta.borderClass} pl-5`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-medium">{message.author}</p>
              <span className="text-muted-foreground text-xs">
                {formatDateTime(message.timestamp)}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-[11px] font-medium tracking-[0.14em] uppercase">
              {meta.label}
            </p>
            <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-7">{message.body}</p>
            {message.status ? (
              <p className="text-muted-foreground mt-3 text-xs">{message.status}</p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
