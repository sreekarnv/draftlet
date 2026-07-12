export type Connector = "gmail" | "telegram";

export type DraftStatus = "generating" | "ready" | "accepted" | "sent";

export type { Coverage, Length, Tone } from "@/lib/contracts.ui";

export type MessageKind = "incoming" | "outgoing" | "draft" | "accepted";

export type Message = {
  id: string;
  kind: MessageKind;
  author: string;
  timestamp: string;
  body: string;
  status?: string;
};

export type DraftVariant = {
  id: string;
  title: string;
  detail: string;
  body: string;
};

export type Draft = {
  id: string;
  conversationId: string;
  status: DraftStatus;
  title: string;
  provider: string;
  instruction: string;
  text: string;
  selectedVariantId?: string;
  selectedMessages: Array<{ author: string; detail: string }>;
  references: string[];
  variants: DraftVariant[];
  createdAt: string;
  updatedAt: string;
};

export type Conversation = {
  id: string;
  connector: Connector;
  title: string;
  contact: string;
  participants: string;
  source: string;
  latestMessage: string;
  timestamp: string;
  capturedAt: string;
  draftPending: boolean;
  needsFollowUp: boolean;
  recentlyCaptured: boolean;
  draftIds: string[];
  latestDraftId?: string;
  messages: Message[];
};

export type RuntimeStatus = "offline" | "ready" | "warning";
export type OllamaProviderStatus = "ready" | "offline" | "warning";

export type SearchResult = {
  itemType: "conversation" | "draft";
  id: string;
  title: string;
  subtitle: string;
  snippet: string;
  updatedAt: string;
};
