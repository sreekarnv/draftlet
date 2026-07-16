import { useEffect, useRef } from "react";

import type { Message } from "@/lib/contracts";
import { DayDivider } from "@/modules/conversation-detail/components/day-divider";
import { ChatMessageBubble } from "@/modules/conversation-detail/components/chat-message-bubble";
import {
  buildMessageIndex,
  getMessageDirection,
  getReplyTarget,
  groupMessagesByDay,
} from "@/modules/conversation-detail/utils";

function isSameAuthorCluster(current: Message, previous: Message | undefined) {
  if (!previous) return false;

  return (
    getMessageDirection(current) === getMessageDirection(previous) &&
    current.author === previous.author
  );
}

export function ChatThreadView({ messages }: { messages: Message[] }) {
  const index = buildMessageIndex(messages);
  const groups = groupMessagesByDay(messages);
  const bottomRef = useRef<HTMLDivElement>(null);
  const latestMessageId = messages.at(-1)?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [latestMessageId]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      {groups.map((group) => (
        <section key={group.key} className="space-y-4">
          <DayDivider label={group.label} />
          <div className="space-y-1.5">
            {group.messages.map((message, indexInGroup) => {
              const compact = isSameAuthorCluster(message, group.messages[indexInGroup - 1]);

              return (
                <ChatMessageBubble
                  key={message.id}
                  message={message}
                  replyTarget={getReplyTarget(message, index)}
                  compact={compact}
                />
              );
            })}
          </div>
        </section>
      ))}
      <div ref={bottomRef} aria-hidden />
    </div>
  );
}
