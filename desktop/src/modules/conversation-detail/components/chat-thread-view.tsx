import type { Message } from "@/lib/contracts";
import { DayDivider } from "@/modules/conversation-detail/components/day-divider";
import { ChatMessageBubble } from "@/modules/conversation-detail/components/chat-message-bubble";
import {
  buildMessageIndex,
  getReplyTarget,
  groupMessagesByDay,
} from "@/modules/conversation-detail/utils";

export function ChatThreadView({ messages }: { messages: Message[] }) {
  const index = buildMessageIndex(messages);
  const groups = groupMessagesByDay(messages);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      {groups.map((group) => (
        <section key={group.key} className="space-y-4">
          <DayDivider label={group.label} />
          <div className="space-y-3">
            {group.messages.map((message) => (
              <ChatMessageBubble
                key={message.id}
                message={message}
                replyTarget={getReplyTarget(message, index)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
