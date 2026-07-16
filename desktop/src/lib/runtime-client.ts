import type {
  Conversation,
  Coverage,
  Draft,
  DraftVariant,
  Length,
  Message,
  SearchResult,
  TelegramSendResult,
  Tone,
} from "@/lib/contracts";

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
  | "externalThreadId"
  | "threadKind"
  | "messages"
> & {
  latest_message: string;
  captured_at: string;
  draft_pending: boolean;
  needs_follow_up: boolean;
  recently_captured: boolean;
  draft_ids: string[];
  latest_draft_id: string | null;
  external_thread_id: string | null;
  thread_kind: string | null;
  messages: ApiMessage[];
};

type ApiMessage = Omit<
  Message,
  "sourceMessageId" | "externalMessageId" | "replyToMessageId" | "replyToExternalMessageId"
> & {
  source_message_id?: string | null;
  external_message_id?: string | null;
  reply_to_message_id?: string | null;
  reply_to_external_message_id?: string | null;
};

type ApiDraft = Omit<
  Draft,
  | "conversationId"
  | "selectedVariantId"
  | "replyTargetMessageId"
  | "sendMode"
  | "selectedMessages"
  | "createdAt"
  | "updatedAt"
> & {
  conversation_id: string;
  selected_variant_id: string | null;
  reply_target_message_id: string | null;
  send_mode: string | null;
  selected_messages: Draft["selectedMessages"];
  created_at: string;
  updated_at: string;
};

type ApiTelegramSendResult = Omit<TelegramSendResult, "draft" | "message"> & {
  draft: ApiDraft;
  message: ApiMessage;
};

type ApiConnector = {
  id: string;
  kind: string;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  updated_at: string;
};

export type TelegramAuthStatus = {
  state: string;
  connected: boolean;
  username: string | null;
  phone: string | null;
  phone_code_hash: string | null;
  error: string | null;
  delivery: string | null;
  timeout: number | null;
  next_delivery: string | null;
  length: number | null;
};

export type TelegramQrStart = {
  state: string;
  url: string;
  expires_at: string;
  expires_in: number;
};

export type TelegramQrStatus = {
  state: string;
  connected: boolean;
  username: string | null;
  error: string | null;
  expires_at: string | null;
  expires_in: number | null;
};

type ApiSetting = { key: string; value: unknown; updated_at: string };

type RuntimeRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export type CaptureCreate = {
  connector_kind: "gmail" | "telegram";
  source_message_id: string;
  external_thread_id?: string;
  external_message_id?: string;
  reply_to_external_message_id?: string;
  metadata?: Record<string, unknown>;
  title: string;
  contact: string;
  participants?: string;
  body: string;
  author?: string;
  timestamp?: string;
};

export type GmailCaptureCreate = {
  gmail_message_id: string;
  gmail_thread_id?: string;
  reply_to_gmail_message_id?: string;
  subject?: string;
  sender?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  body: string;
  body_format?: string;
  gmail_url?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
};

export type ApiCapture = {
  id: string;
  connector_kind: string;
  source_message_id: string;
  external_thread_id: string | null;
  external_message_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  status: string;
  captured_at: string;
};

type ApiSearchResult = Omit<SearchResult, "itemType" | "updatedAt"> & {
  item_type: SearchResult["itemType"];
  updated_at: string;
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
    externalThreadId: value.external_thread_id ?? undefined,
    threadKind: value.thread_kind ?? undefined,
    messages: value.messages.map(message),
  };
}

function message(value: ApiMessage): Message {
  return {
    ...value,
    sourceMessageId: value.source_message_id ?? undefined,
    externalMessageId: value.external_message_id ?? undefined,
    replyToMessageId: value.reply_to_message_id ?? undefined,
    replyToExternalMessageId: value.reply_to_external_message_id ?? undefined,
  };
}

function draft(value: ApiDraft): Draft {
  return {
    ...value,
    conversationId: value.conversation_id,
    selectedVariantId: value.selected_variant_id ?? undefined,
    replyTargetMessageId: value.reply_target_message_id ?? undefined,
    sendMode: value.send_mode ?? undefined,
    selectedMessages: value.selected_messages,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

function telegramSendResult(value: ApiTelegramSendResult): TelegramSendResult {
  return {
    ...value,
    draft: draft(value.draft),
    message: message(value.message),
  };
}

function searchResult(value: ApiSearchResult): SearchResult {
  return {
    ...value,
    itemType: value.item_type,
    updatedAt: value.updated_at,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const requestInit: RequestInit = {
    ...init,
    headers,
  };

  const ipcRequestInit: RuntimeRequestInit = {
    method: init?.method,
    headers: Object.fromEntries(headers.entries()),
    body: typeof init?.body === "string" ? init.body : undefined,
  };

  if (window.draftlet) {
    const response = await window.draftlet.runtime.request(`/api/v1${path}`, ipcRequestInit);
    if (!response.ok) throw new Error(formatRuntimeError(response.body, response.status));
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

function formatRuntimeError(body: string, status: number): string {
  const fallback = `Runtime request failed (${status})`;
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    if (typeof parsed.detail === "string") {
      return parsed.detail;
    }
    if (parsed.detail) {
      return JSON.stringify(parsed.detail);
    }
  } catch {
    return fallback;
  }
  return fallback;
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
    return request<ApiConnector>(`/connectors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  async startTelegramAuth(phone: string) {
    return request<TelegramAuthStatus>("/connectors/telegram/auth/send-code", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
  },
  async signInTelegram(phone: string, code: string, phoneCodeHash?: string | null) {
    return request<TelegramAuthStatus>("/connectors/telegram/auth/sign-in", {
      method: "POST",
      body: JSON.stringify({ phone, code, phone_code_hash: phoneCodeHash }),
    });
  },
  async signInTelegramPassword(password: string) {
    return request<TelegramAuthStatus>("/connectors/telegram/auth/sign-in-password", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },
  async disconnectTelegram() {
    return request<TelegramAuthStatus>("/connectors/telegram/auth/disconnect", { method: "POST" });
  },
  async telegramAuthStatus() {
    return request<TelegramAuthStatus>("/connectors/telegram/auth/status");
  },
  async startTelegramQr() {
    return request<TelegramQrStart>("/connectors/telegram/auth/qr/start", { method: "POST" });
  },
  async telegramQrStatus() {
    return request<TelegramQrStatus>("/connectors/telegram/auth/qr/status");
  },
  async cancelTelegramQr() {
    return request<TelegramQrStatus>("/connectors/telegram/auth/qr/cancel", { method: "POST" });
  },
  async getSetting(key: string) {
    return request<ApiSetting>(`/settings/${key}`);
  },
  async updateSetting(key: string, value: unknown) {
    return request<ApiSetting>(`/settings/${key}`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    });
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
  async ingestGmailCapture(payload: GmailCaptureCreate) {
    return request<ApiCapture>("/connectors/gmail/captures", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async search(q: string) {
    const value = await request<{ items: ApiSearchResult[] }>(`/search?q=${encodeURIComponent(q)}`);
    return value.items.map(searchResult);
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
  async generateVariant(
    id: string,
    options: { tone?: Tone; length?: Length; coverage?: Coverage } = {},
  ) {
    return request<DraftVariant>(`/drafts/${id}/variants/generate`, {
      method: "POST",
      body: JSON.stringify(options),
    });
  },
  async acceptDraft(id: string) {
    return draft(await request<ApiDraft>(`/drafts/${id}/accept`, { method: "POST" }));
  },
  async sendDraftViaTelegram(
    id: string,
    payload: { body: string; reply_to_original?: boolean; mark_sent?: boolean },
  ) {
    return telegramSendResult(
      await request<ApiTelegramSendResult>(`/drafts/${id}/send/telegram`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  },
  async markDraftSent(id: string) {
    return draft(await request<ApiDraft>(`/drafts/${id}/mark-sent`, { method: "POST" }));
  },
  async markConversationCaptured(id: string) {
    return conversation(
      await request<ApiConversation>(`/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ recently_captured: false }),
      }),
    );
  },
  async health() {
    if (window.draftlet) {
      const response = await window.draftlet.runtime.request("/health");
      return JSON.parse(response.body);
    }
    return fetch("http://127.0.0.1:8000/health").then((response) => response.json());
  },
};
