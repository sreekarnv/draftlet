import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { Conversation, Message } from "@/lib/contracts";
import { queryKeys } from "@/lib/queries/keys";

type RuntimeEvent = Record<string, unknown> & { type?: string };

type MessageCreatedEvent = RuntimeEvent & {
  type: "message.created";
  conversation_id: string;
  latest_message: string;
  timestamp: string;
  recently_captured: boolean;
  message: Message;
};

function isMessageCreatedEvent(event: RuntimeEvent): event is MessageCreatedEvent {
  return (
    event.type === "message.created" &&
    typeof event.conversation_id === "string" &&
    typeof event.latest_message === "string" &&
    typeof event.timestamp === "string" &&
    typeof event.recently_captured === "boolean" &&
    typeof event.message === "object" &&
    event.message !== null
  );
}

function updateConversationWithMessage(
  conversations: Conversation[] | undefined,
  event: MessageCreatedEvent,
) {
  if (!conversations) return conversations;

  let updatedConversation: Conversation | undefined;
  const remaining = conversations.filter((conversation) => {
    if (conversation.id !== event.conversation_id) return true;

    const messageExists = conversation.messages.some((message) => message.id === event.message.id);
    updatedConversation = {
      ...conversation,
      latestMessage: event.latest_message,
      timestamp: event.timestamp,
      recentlyCaptured: event.recently_captured,
      messages: messageExists ? conversation.messages : [...conversation.messages, event.message],
    };
    return false;
  });

  return updatedConversation ? [updatedConversation, ...remaining] : conversations;
}

export function RuntimeEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = window.draftlet?.runtime.onEvent((event: RuntimeEvent) => {
      switch (event.type) {
        case "message.created":
          if (isMessageCreatedEvent(event)) {
            let cacheHit = false;
            queryClient.setQueryData<Conversation[]>(queryKeys.conversations, (conversations) => {
              const updated = updateConversationWithMessage(conversations, event);
              cacheHit = updated !== conversations;
              return updated;
            });
            if (!cacheHit) {
              void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
            }
          } else {
            void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
          }
          void queryClient.invalidateQueries({ queryKey: queryKeys.captures });
          void queryClient.invalidateQueries({ queryKey: queryKeys.drafts });
          break;
        case "conversation.updated":
          void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
          break;
        default:
          break;
      }
    });

    return () => unsubscribe?.();
  }, [queryClient]);

  return null;
}
