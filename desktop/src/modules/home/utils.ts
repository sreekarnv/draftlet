import { FileText, Library, Mail, MessageCircle, PlugZap, Server, Sparkles } from "lucide-react";
import type { Conversation, Draft } from "@/lib/contracts";
import type { ActivityItem, QuickAction, StatusItem } from "@/modules/home/types";

export function getPrimaryDraft(drafts: Draft[]): Draft | undefined {
  return drafts.find((draft) => draft.status === "ready") ?? drafts[0];
}

export function getRecentConversations(conversations: Conversation[]): ActivityItem[] {
  return conversations.slice(0, 4).map((conversation) => ({
    title: `${conversation.connector}: ${conversation.title}`,
    connector: conversation.connector,
    detail: conversation.capturedAt,
  }));
}

export function getFollowUpDrafts(drafts: Draft[]): ActivityItem[] {
  return [...drafts]
    .filter((draft) => draft.status !== "generating")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4)
    .map((draft) => ({
      title: draft.title,
      detail: draft.instruction,
      status: draft.status,
    }));
}

export function getStatusItems(runtime = "offline", ollama = "offline"): StatusItem[] {
  return [
    {
      label: "Draftlet Runtime",
      value: runtime === "ready" ? "Ready" : "Offline",
      detail: runtime === "ready" ? "Connected" : "Not connected",
      state: runtime,
      icon: Server,
    },
    {
      label: "Ollama Provider",
      value: ollama === "ready" ? "Ready" : "Offline",
      detail: ollama === "ready" ? "Available" : "Not connected",
      state: ollama,
      icon: Sparkles,
    },
    { label: "Gmail", value: "Offline", detail: "Not connected", state: "offline", icon: Mail },
    {
      label: "Telegram",
      value: "Offline",
      detail: "Not connected",
      state: "offline",
      icon: MessageCircle,
    },
  ];
}

export function getQuickActions(primaryDraft?: Draft): QuickAction[] {
  return [
    ...(primaryDraft
      ? [
          {
            label: "Continue Draft",
            to: `/drafts/${primaryDraft.id}`,
            icon: FileText,
            primary: true,
          },
        ]
      : []),
    { label: "Open Library", to: "/library", icon: Library, primary: false },
    { label: "Check Connectors", to: "/connectors", icon: PlugZap, primary: false },
  ];
}
