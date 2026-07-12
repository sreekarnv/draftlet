import type { Conversation, Coverage, Draft, DraftVariant, Length, Tone } from "@/lib/contracts";

const baseUrl = "http://127.0.0.1:8000/api/v1";

type ApiConversation = Omit<
  Conversation,
  | "latestMessage"
  | "capturedAt"
  | "draftPending"
  | "needsFollowUp"
  | "recentlyCaptured"
  | "draftIds"
  | "latestDraftId"
> & {
  latest_message: string;
  captured_at: string;
  draft_pending: boolean;
  needs_follow_up: boolean;
  recently_captured: boolean;
  draft_ids: string[];
  latest_draft_id: string | null;
};
type ApiDraft = Omit<
  Draft,
  "conversationId" | "selectedVariantId" | "selectedMessages" | "createdAt" | "updatedAt"
> & {
  conversation_id: string;
  selected_variant_id: string | null;
  selected_messages: Draft["selectedMessages"];
  created_at: string;
  updated_at: string;
};
type ApiConnector = { id: string; kind: string; name: string; enabled: boolean; config: Record<string, unknown>; updated_at: string };
type ApiSetting = { key: string; value: unknown; updated_at: string };
export type CaptureCreate = {
  connector_kind: "gmail" | "telegram";
  source_message_id: string;
  title: string;
  contact: string;
  participants?: string;
  body: string;
  author?: string;
};
export type ApiCapture = {
  id: string;
  connector_kind: string;
  source_message_id: string;
  conversation_id: string | null;
  message_id: string | null;
  status: string;
  captured_at: string;
};

function conversation(value: ApiConversation): Conversation {
  return {
    ...value,
    latestMessage: value.latest_message,
    capturedAt: value.captured_at,
    draftPending: value.draft_pending,
    needsFollowUp: value.needs_follow_up,
    recentlyCaptured: value.recently_captured,
    draftIds: value.draft_ids,
    latestDraftId: value.latest_draft_id ?? undefined,
  };
}

function draft(value: ApiDraft): Draft {
  return {
    ...value,
    conversationId: value.conversation_id,
    selectedVariantId: value.selected_variant_id ?? undefined,
    selectedMessages: value.selected_messages,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const requestInit: RequestInit = {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  };

  if (window.draftlet) {
    const response = await window.draftlet.runtime.request(`/api/v1${path}`, requestInit);
    if (!response.ok)
      throw new Error(
        JSON.parse(response.body).detail ?? `Runtime request failed (${response.status})`,
      );
    return JSON.parse(response.body) as T;
  }
  const response = await fetch(`${baseUrl}${path}`, requestInit);
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => null))?.detail ??
        `Runtime request failed (${response.status})`,
    );
  return response.json() as Promise<T>;
}

export const runtimeClient = {
  async listConversations() {
    const value = await request<{ items: ApiConversation[] }>("/conversations");
    return value.items.map(conversation);
  },
  async listDrafts() {
    const value = await request<{ items: ApiDraft[] }>("/drafts");
    return value.items.map(draft);
  },
  async listConnectors() {
    return request<ApiConnector[]>("/connectors");
  },
  async updateConnector(id: string, patch: Partial<Pick<ApiConnector, "enabled" | "config">>) {
    return request<ApiConnector>(`/connectors/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  },
  async getSetting(key: string) {
    return request<ApiSetting>(`/settings/${key}`);
  },
  async updateSetting(key: string, value: unknown) {
    return request<ApiSetting>(`/settings/${key}`, { method: "PATCH", body: JSON.stringify({ value }) });
  },
  async listOllamaModels() {
    return request<string[]>("/ollama/models");
  },
  async listCaptures() {
    const value = await request<{ items: ApiCapture[] }>("/captures");
    return value.items;
  },
  async ingestCapture(payload: CaptureCreate) {
    return request<ApiCapture>("/captures", { method: "POST", body: JSON.stringify(payload) });
  },
  async generate(
    conversationId: string,
    options: { tone?: Tone; length?: Length; coverage?: Coverage } = {},
  ) {
    return draft(
      await request<ApiDraft>("/generations", {
        method: "POST",
        body: JSON.stringify({ conversation_id: conversationId, ...options }),
      }),
    );
  },
  async updateDraft(id: string, patch: Partial<Draft>) {
    const payload: Record<string, unknown> = { ...patch };
    if ("selectedVariantId" in payload) {
      payload.selected_variant_id = payload.selectedVariantId;
      delete payload.selectedVariantId;
    }
    if ("selectedMessages" in payload) {
      payload.selected_messages = payload.selectedMessages;
      delete payload.selectedMessages;
    }
    return draft(
      await request<ApiDraft>(`/drafts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    );
  },
  async addVariant(id: string, variant: DraftVariant) {
    return request<DraftVariant>(`/drafts/${id}/variants`, {
      method: "POST",
      body: JSON.stringify(variant),
    });
  },
  async acceptDraft(id: string) {
    return draft(await request<ApiDraft>(`/drafts/${id}/accept`, { method: "POST" }));
  },
  async markDraftSent(id: string) {
    return draft(await request<ApiDraft>(`/drafts/${id}/mark-sent`, { method: "POST" }));
  },
  async markConversationCaptured(id: string) {
    return conversation(await request<ApiConversation>(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ recently_captured: true }) }));
  },
  async health() {
    if (window.draftlet) {
      const response = await window.draftlet.runtime.request("/health");
      return JSON.parse(response.body);
    }
    return fetch("http://127.0.0.1:8000/health").then((response) => response.json());
  },
};
