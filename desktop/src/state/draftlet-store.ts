import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type {
  Conversation,
  Coverage,
  Draft,
  DraftStatus,
  DraftVariant,
  Length,
  Message,
  Tone,
} from "@/lib/contracts";
import { mockConversations, mockDraftWorkspace } from "@/lib/mock-data";

const SEED_FLAG_KEY = "draftlet:seeded:v1";

const COVERAGE_TAILS: Record<Coverage, string> = {
  Brief: "Happy to elaborate if useful.",
  "Answer all points": "Let me know if you want any of this reworded or expanded.",
  Detailed: "Let me know if any of these land in the wrong place and I'll iterate.",
};

const LENGTH_TAILS: Record<Length, string> = {
  Short: "I'll follow up shortly with the next step.",
  Medium: "I'll send a fuller note shortly with the supporting detail.",
  Long: "I'll send a more detailed pass shortly that walks through each point you raised.",
};

function buildReply(
  conversation: Conversation,
  tone: Tone,
  length: Length,
  coverage: Coverage,
): string {
  const greetingTone =
    tone === "Warm" || tone === "Friendly"
      ? `Hi ${conversation.contact}`
      : `Hello ${conversation.contact}`;

  const opener = conversation.latestMessage
    ? `Thanks for your note about "${conversation.latestMessage.slice(0, 60)}${conversation.latestMessage.length > 60 ? "…" : ""}".`
    : "Thanks for the note.";

  return `${greetingTone},

${opener} ${LENGTH_TAILS[length]}

${COVERAGE_TAILS[coverage]}

Best`;
}

function generateReply(
  conversation: Conversation,
  options: { tone?: Tone; length?: Length; coverage?: Coverage } = {},
): Omit<Draft, "createdAt" | "updatedAt"> {
  const tone = options.tone ?? "Direct";
  const length = options.length ?? "Short";
  const coverage = options.coverage ?? "Answer all points";

  return {
    id: crypto.randomUUID(),
    conversationId: conversation.id,
    status: "ready",
    title: `Reply to ${conversation.title}`,
    provider: "stub",
    instruction: `${tone} · ${length} · ${coverage}`,
    text: buildReply(conversation, tone, length, coverage),
    selectedMessages: conversation.latestMessage
      ? [{ author: conversation.contact, detail: conversation.latestMessage }]
      : [],
    references: conversation.participants ? [conversation.participants] : [],
    variants: [],
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneConversations(): Conversation[] {
  return mockConversations.map((conversation) => ({
    ...conversation,
    draftIds: [...conversation.draftIds],
    messages: conversation.messages.map((message: Message) => ({ ...message })),
  }));
}

function seedDrafts(): Draft[] {
  const matched = mockConversations.find((c) => c.id === mockDraftWorkspace.conversationId);
  if (!matched) {
    return [];
  }

  const timestamp = nowIso();
  const draft: Draft = {
    ...mockDraftWorkspace,
    selectedMessages: mockDraftWorkspace.selectedMessages.map((m) => ({ ...m })),
    references: [...mockDraftWorkspace.references],
    variants: mockDraftWorkspace.variants.map((v) => ({ ...v })),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return [draft];
}

function buildSeed(): { conversations: Conversation[]; drafts: Draft[] } {
  const conversations = cloneConversations();
  const drafts = seedDrafts();

  for (const draft of drafts) {
    const conversation = conversations.find((c) => c.id === draft.conversationId);
    if (conversation) {
      conversation.draftIds.push(draft.id);
      conversation.latestDraftId = draft.id;
    }
  }

  return { conversations, drafts };
}

type State = {
  conversations: Conversation[];
  drafts: Draft[];
  hydrated: boolean;
};

type Actions = {
  setHydrated: (value: boolean) => void;
  generateDraftFromConversation: (
    conversationId: string,
    options?: { tone?: Tone; length?: Length },
  ) => string | null;
  updateDraft: (
    id: string,
    patch: Partial<Omit<Draft, "id" | "conversationId" | "createdAt">>,
  ) => void;
  addDraftVariant: (id: string, variant: DraftVariant) => void;
  setDraftStatus: (id: string, status: DraftStatus) => void;
  acceptDraft: (id: string) => void;
  markDraftSent: (id: string) => void;
  markConversationCaptured: (id: string) => void;
  resetToSeed: () => void;
};

export type DraftletStore = State & Actions;

const initial: State = {
  conversations: [],
  drafts: [],
  hydrated: false,
};

export const useDraftletStore = create<DraftletStore>()(
  persist(
    (set, get) => ({
      ...initial,

      setHydrated: (value) => {
        set({ hydrated: value });
      },

      generateDraftFromConversation: (conversationId, options) => {
        const conversation = get().conversations.find((c) => c.id === conversationId);
        if (!conversation) {
          return null;
        }

        const seeded = generateReply(conversation, options);
        const timestamp = nowIso();
        const draft: Draft = { ...seeded, createdAt: timestamp, updatedAt: timestamp };

        set((state) => ({
          drafts: [draft, ...state.drafts],
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  draftIds: [draft.id, ...c.draftIds],
                  latestDraftId: draft.id,
                  draftPending: true,
                }
              : c,
          ),
        }));

        return draft.id;
      },

      updateDraft: (id, patch) => {
        set((state) => ({
          drafts: state.drafts.map((draft) =>
            draft.id === id ? { ...draft, ...patch, updatedAt: nowIso() } : draft,
          ),
        }));
      },

      addDraftVariant: (id, variant) => {
        set((state) => ({
          drafts: state.drafts.map((draft) =>
            draft.id === id
              ? { ...draft, variants: [...draft.variants, variant], updatedAt: nowIso() }
              : draft,
          ),
        }));
      },

      setDraftStatus: (id, status) => {
        set((state) => ({
          drafts: state.drafts.map((draft) =>
            draft.id === id ? { ...draft, status, updatedAt: nowIso() } : draft,
          ),
        }));
      },

      acceptDraft: (id) => {
        const draft = get().drafts.find((d) => d.id === id);
        if (!draft) {
          return;
        }
        const acceptedMessage: Message = {
          id: `accepted-${id}-${Date.now()}`,
          kind: "accepted",
          author: "Sreekar",
          timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
          body: draft.text,
          status: "Accepted and inserted",
        };

        set((state) => ({
          drafts: state.drafts.map((d) =>
            d.id === id ? { ...d, status: "accepted" as const, updatedAt: nowIso() } : d,
          ),
          conversations: state.conversations.map((c) =>
            c.id === draft.conversationId
              ? { ...c, draftPending: false, messages: [...c.messages, acceptedMessage] }
              : c,
          ),
        }));
      },

      markDraftSent: (id) => {
        get().setDraftStatus(id, "sent");
      },

      markConversationCaptured: (id) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, recentlyCaptured: true } : c,
          ),
        }));
      },

      resetToSeed: () => {
        const seed = buildSeed();
        set({ conversations: seed.conversations, drafts: seed.drafts });
      },
    }),
    {
      name: "draftlet:v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ conversations: state.conversations, drafts: state.drafts }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          return;
        }
        if (!state) {
          return;
        }
        const hasAnyData = state.conversations.length > 0 || state.drafts.length > 0;
        const seededFlag =
          typeof window !== "undefined" && window.localStorage.getItem(SEED_FLAG_KEY);
        if (!hasAnyData && !seededFlag) {
          const seed = buildSeed();
          state.conversations = seed.conversations;
          state.drafts = seed.drafts;
          if (typeof window !== "undefined") {
            window.localStorage.setItem(SEED_FLAG_KEY, "1");
          }
        }
        state.setHydrated(true);
      },
    },
  ),
);
