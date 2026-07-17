import { useEffect, useRef } from "react";

import { useMarkConversationCaptured as useMarkConversationCapturedMutation } from "@/lib/queries/conversations";

export function useMarkConversationCaptured(
  conversationId: string | undefined,
  recentlyCaptured: boolean | undefined,
) {
  const { mutate } = useMarkConversationCapturedMutation();
  const markedConversationIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    if (!recentlyCaptured) {
      markedConversationIdsRef.current.delete(conversationId);
      return;
    }

    if (markedConversationIdsRef.current.has(conversationId)) {
      return;
    }

    markedConversationIdsRef.current.add(conversationId);

    mutate(conversationId);
  }, [conversationId, mutate, recentlyCaptured]);
}
