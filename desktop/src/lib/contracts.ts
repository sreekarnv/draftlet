export type Connector = "Gmail" | "Telegram";

export type DraftStatus = "generating" | "ready" | "accepted" | "sent";

export type Tone = "Direct" | "Warm" | "Formal" | "Friendly";
export type Length = "Short" | "Medium" | "Long";
export type Coverage = "Brief" | "Answer all points" | "Detailed";

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
