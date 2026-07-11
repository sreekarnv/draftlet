import { useEffect } from "react";

import { useDraftletStore } from "@/state/draftlet-store";

export function useMarkConversationCaptured(
  conversationId: string | undefined,
  markConversationCaptured: (id: string) => void,
) {
  // TODO(architecture): distinguish viewed from captured once connector capture events exist.
  // Today "Recently captured" effectively means "recently viewed" because we mark on mount.
  // Read the latest store value so the effect does not re-fire after this action mutates the record.
  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const conversation = useDraftletStore
      .getState()
      .conversations.find((item) => item.id === conversationId);

    if (conversation && !conversation.recentlyCaptured) {
      markConversationCaptured(conversationId);
    }
  }, [conversationId, markConversationCaptured]);
}
