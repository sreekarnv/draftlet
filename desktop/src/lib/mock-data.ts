// TODO: to remove this
// Temporary static desktop mock data. Replace with shared contracts/runtime APIs when available.

import type {
  Conversation,
  Draft,
  Message,
  OllamaProviderStatus,
  RuntimeStatus,
} from "@/lib/contracts";

export const mockRuntimeStatus = {
  label: "Runtime",
  value: "Offline",
  detail: "Local Draftlet runtime is not connected",
  state: "offline" satisfies RuntimeStatus,
};

export const mockOllamaProviderStatus = {
  label: "Ollama",
  value: "llama3.1 selected",
  detail: "Provider connector ready",
  state: "ready" satisfies OllamaProviderStatus,
};

export const mockConnectorStatuses = [
  {
    label: "Gmail connector",
    value: "Connected",
    detail: "Watching supported local capture flow",
    state: "ready" satisfies RuntimeStatus,
  },
  {
    label: "Telegram connector",
    value: "Needs check",
    detail: "Telegram Desktop connector needs review",
    state: "warning" satisfies RuntimeStatus,
  },
];

export const mockConversations: Conversation[] = [
  {
    id: "gmail-launch-notes",
    connector: "Gmail",
    title: "Launch notes feedback",
    contact: "Mira Patel",
    participants: "Mira Patel, Sreekar",
    source: "Gmail / Product writing",
    latestMessage:
      "The positioning is stronger now. I would still tighten the second paragraph and make the Linux-first line more explicit.",
    timestamp: "18m",
    capturedAt: "Captured 18 minutes ago",
    draftPending: true,
    needsFollowUp: true,
    recentlyCaptured: true,
    draftIds: [],
    messages: [
      {
        id: "incoming-1",
        kind: "incoming",
        author: "Mira Patel",
        timestamp: "10:18 AM",
        body: "The positioning is stronger now. I would still tighten the second paragraph and make the Linux-first line more explicit before we use this in the update.",
      },
      {
        id: "outgoing-1",
        kind: "outgoing",
        author: "Sreekar",
        timestamp: "10:24 AM",
        body: "Agreed. I am going to make the local-first framing more concrete and remove the generic assistant language.",
      },
      {
        id: "draft-1",
        kind: "draft",
        author: "Draftlet",
        timestamp: "Generated 10:29 AM",
        body: "Thanks, this direction makes sense. I tightened the second paragraph and made the Linux-first/local-first framing explicit. I also replaced the generic assistant phrasing with connector-oriented language so the update reads more like a desktop product note than an AI feature announcement.",
        status: "Generated draft pending review",
      },
      {
        id: "accepted-1",
        kind: "accepted",
        author: "Sreekar",
        timestamp: "Inserted 10:34 AM",
        body: "Thanks, this direction makes sense. I tightened the second paragraph and made the Linux-first/local-first framing explicit, then replaced the generic assistant phrasing with connector-oriented language.",
        status: "Accepted and inserted into Gmail",
      },
    ] satisfies Message[],
  },
  {
    id: "telegram-support-room",
    connector: "Telegram",
    title: "Connector support question",
    contact: "Draftlet testers",
    participants: "Telegram Desktop group: Draftlet testers",
    source: "Telegram Desktop / Support room",
    latestMessage:
      "Can we keep the connector status local and avoid adding an account requirement for diagnostics?",
    timestamp: "42m",
    capturedAt: "Captured 42 minutes ago",
    draftPending: true,
    needsFollowUp: true,
    recentlyCaptured: true,
    draftIds: [],
    messages: [],
  },
  {
    id: "gmail-outline-review",
    connector: "Gmail",
    title: "Outline review for local memory guide",
    contact: "Jon Bell",
    participants: "Jon Bell, Sreekar",
    source: "Gmail / Docs feedback",
    latestMessage:
      "The flow works. The setup section needs one concrete example before the follow-up workflow.",
    timestamp: "Yesterday",
    capturedAt: "Captured yesterday",
    draftPending: false,
    needsFollowUp: true,
    recentlyCaptured: false,
    draftIds: [],
    messages: [],
  },
  {
    id: "telegram-runtime-thread",
    connector: "Telegram",
    title: "Runtime packaging discussion",
    contact: "Linux desktop channel",
    participants: "Telegram Desktop channel: Linux desktop",
    source: "Telegram Desktop / Runtime",
    latestMessage:
      "AppImage is fine for early testing, but the runtime status should explain what failed without opening logs first.",
    timestamp: "Mon",
    capturedAt: "Captured Monday",
    draftPending: false,
    needsFollowUp: false,
    recentlyCaptured: false,
    draftIds: [],
    messages: [],
  },
  {
    id: "gmail-editorial-calendar",
    connector: "Gmail",
    title: "Editorial calendar next steps",
    contact: "Rhea Singh",
    participants: "Rhea Singh, Sreekar",
    source: "Gmail / Editorial",
    latestMessage:
      "Let's turn the notes into a short draft and keep the connector examples concrete.",
    timestamp: "Jun 28",
    capturedAt: "Captured Jun 28",
    draftPending: true,
    needsFollowUp: false,
    recentlyCaptured: false,
    draftIds: [],
    messages: [],
  },
];

export const mockDraftWorkspace: Omit<Draft, "createdAt" | "updatedAt"> = {
  id: "draft-seed-launch-notes",
  conversationId: "gmail-launch-notes",
  status: "ready",
  title: "Reply to launch notes feedback",
  provider: "Ollama llama3.1 mock generation",
  instruction:
    "Keep the reply concise and specific. Acknowledge the feedback, mention the Linux-first framing update, and avoid generic assistant language.",
  text: `Thanks, this direction makes sense. I tightened the second paragraph and made the Linux-first/local-first framing explicit. I also replaced the generic assistant phrasing with connector-oriented language so the update reads more like a desktop product note than an AI feature announcement.

I kept the reply short and focused on the concrete changes: local capture, supported connectors, and Ollama as the first provider connector.`,
  selectedMessages: [
    {
      author: "Mira Patel",
      detail:
        "The positioning is stronger now. I would still tighten the second paragraph and make the Linux-first line more explicit.",
    },
    {
      author: "Sreekar",
      detail:
        "I am going to make the local-first framing more concrete and remove generic assistant language.",
    },
  ],
  references: ["Linux-first positioning notes", "Connector setup checklist", "Runtime status copy"],
  variants: [
    {
      id: "direct-short",
      title: "Direct short reply",
      detail: "Concise answer covering the requested positioning changes.",
      body: `Thanks for the note, Mira. I tightened the second paragraph and made the Linux-first/local-first framing explicit, and replaced the generic assistant phrasing with connector-oriented language.

Reply is short and focused on the concrete changes: local capture, supported connectors, and Ollama as the first provider connector.`,
    },
    {
      id: "warm-medium",
      title: "Warm medium reply",
      detail: "Adds acknowledgement and a slightly more collaborative close.",
      body: `Hi Mira,

Thanks so much for this — really helpful. I tightened the second paragraph and made the Linux-first/local-first framing more explicit. I also swapped out the generic assistant phrasing for connector-oriented language so the update reads like a desktop product note rather than an AI feature announcement.

I'll send the next pass once you've had a chance to look.`,
    },
    {
      id: "detailed",
      title: "Detailed coverage",
      detail: "Covers Linux-first, connector wording, and the second paragraph rewrite.",
      body: `Thanks, Mira. I went through the note end-to-end and made three concrete changes:

1. Tightened the second paragraph so the lead sentence carries the argument instead of leading with framing.
2. Made the Linux-first line explicit, and tied it back to the local-capture positioning so it reads as a product decision, not a slogan.
3. Replaced the generic assistant phrasing with connector-oriented language throughout — local capture, supported connectors, Ollama as the first provider connector.

Let me know if any of those land in the wrong place and I'll iterate.`,
    },
  ],
  selectedVariantId: "direct-short",
};
