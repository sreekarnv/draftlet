import { useEffect } from "react";

import { useMarkConversationCaptured as useMarkConversationCapturedMutation } from "@/lib/queries/conversations";

export function useMarkConversationCaptured(
  conversationId: string | undefined,
  recentlyCaptured: boolean | undefined,
) {
  const markConversationCaptured = useMarkConversationCapturedMutation();

  useEffect(() => {
    if (!conversationId || recentlyCaptured) {
      return;
    }

    markConversationCaptured.mutate(conversationId);
  }, [conversationId, markConversationCaptured, recentlyCaptured]);
}
