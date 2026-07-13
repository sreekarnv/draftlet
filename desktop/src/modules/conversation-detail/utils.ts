import type { Conversation, Draft, Message } from "@/lib/contracts";

export type ThreadViewKind = "chat" | "email" | "timeline";

export type MessageDayGroup = {
  key: string;
  label: string;
  messages: Message[];
};

export type MessageIndex = {
  byId: Map<string, Message>;
  byExternalId: Map<string, Message>;
};

export function getThreadViewKind(conversation: Conversation): ThreadViewKind {
  if (conversation.threadKind === "chat" || conversation.connector === "telegram") {
    return "chat";
  }
  if (conversation.connector === "gmail") {
    return "email";
  }
  return "timeline";
}

export function buildMessageIndex(messages: Message[]): MessageIndex {
  const byId = new Map<string, Message>();
  const byExternalId = new Map<string, Message>();
  for (const message of messages) {
    byId.set(message.id, message);
    if (message.externalMessageId) {
      byExternalId.set(message.externalMessageId, message);
    }
  }
  return { byId, byExternalId };
}

export function getReplyTarget(message: Message, index: MessageIndex): Message | undefined {
  if (message.replyToMessageId) {
    const target = index.byId.get(message.replyToMessageId);
    if (target) return target;
  }
  if (message.replyToExternalMessageId) {
    return index.byExternalId.get(message.replyToExternalMessageId);
  }
  return undefined;
}

export function getDraftReplyTarget(draft: Draft | undefined, conversation: Conversation) {
  if (!draft?.replyTargetMessageId) return undefined;
  return buildMessageIndex(conversation.messages).byId.get(draft.replyTargetMessageId);
}

export function getDraftStateLabel(draft: Draft | undefined): string {
  if (!draft) return "Ready to draft locally";
  if (draft.status === "sent") return "Sent externally";
  if (draft.status === "accepted") return "Inserted locally";
  if (draft.status === "generating") return "Generating locally";
  return "Draft ready";
}

export function getSendModeLabel(sendMode: string | undefined): string {
  if (sendMode === "reply") return "Reply target";
  if (sendMode === "new_message") return "New message";
  return "Local draft";
}

export function groupMessagesByDay(messages: Message[]): MessageDayGroup[] {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const groups = new Map<string, Message[]>();
  for (const message of sorted) {
    const date = new Date(message.timestamp);
    const key = Number.isNaN(date.getTime()) ? "unknown" : date.toISOString().slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), message]);
  }
  return [...groups.entries()].map(([key, items]) => ({
    key,
    label: formatDayLabel(key),
    messages: items,
  }));
}

export function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function getMessageDirection(message: Message): "incoming" | "outgoing" | "local" | "draft" {
  if (message.kind === "outgoing") return "outgoing";
  if (message.kind === "accepted") return "local";
  if (message.kind === "draft") return "draft";
  return "incoming";
}

export function getMessageLabel(message: Message): string {
  if (message.status) return message.status;
  if (message.kind === "outgoing") return "Sent";
  if (message.kind === "accepted") return "Inserted locally";
  if (message.kind === "draft") return "Draft";
  return "Captured";
}

export function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function splitQuotedEmailContent(body: string): { visibleBody: string; quotedBody: string } {
  const patterns = [/\nOn .+ wrote:\n/s, /\n-{2,}\s*Original Message\s*-{2,}\n/is, /\n> .+/s];
  const indexes = patterns.map((pattern) => body.search(pattern)).filter((index) => index >= 0);
  const splitIndex = indexes.length ? Math.min(...indexes) : -1;
  if (splitIndex < 0) {
    return { visibleBody: body, quotedBody: "" };
  }
  return {
    visibleBody: body.slice(0, splitIndex).trim(),
    quotedBody: body.slice(splitIndex).trim(),
  };
}

function formatDayLabel(key: string): string {
  if (key === "unknown") return "Unknown date";
  const date = new Date(`${key}T00:00:00`);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function sameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}
