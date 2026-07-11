import { Conversation } from "@/lib/contracts";
import { LibraryFilter } from "./types";

export function matchesFilter(conversation: Conversation, filter: LibraryFilter) {
  switch (filter) {
    case LibraryFilter.GMAIL:
      return conversation.connector === "Gmail";

    case LibraryFilter.TELEGRAM:
      return conversation.connector === "Telegram";

    case LibraryFilter.DRAFT_PENDING:
      return conversation.draftPending;

    case LibraryFilter.NEEDS_FOLLOW_UP:
      return conversation.needsFollowUp;

    case LibraryFilter.RECENTLY_CAPTURED:
      return conversation.recentlyCaptured;

    default:
      return true;
  }
}

export function conversationStateText(conversation: Conversation) {
  return [
    conversation.draftPending ? "Draft pending" : null,
    conversation.needsFollowUp ? "Needs follow-up" : null,
  ].filter(Boolean);
}
