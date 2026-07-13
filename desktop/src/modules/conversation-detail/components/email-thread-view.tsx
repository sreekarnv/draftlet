import type { Message } from "@/lib/contracts";
import { DayDivider } from "@/modules/conversation-detail/components/day-divider";
import { EmailMessageCard } from "@/modules/conversation-detail/components/email-message-card";
import {
  buildMessageIndex,
  getReplyTarget,
  groupMessagesByDay,
} from "@/modules/conversation-detail/utils";

export function EmailThreadView({ messages }: { messages: Message[] }) {
  const index = buildMessageIndex(messages);
  const groups = groupMessagesByDay(messages);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {groups.map((group) => (
        <section key={group.key} className="space-y-4">
          <DayDivider label={group.label} />
          {group.messages.map((message) => (
            <EmailMessageCard
              key={message.id}
              message={message}
              replyTarget={getReplyTarget(message, index)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
