export const queryKeys = {
  health: ["health"] as const,
  conversations: ["conversations"] as const,
  drafts: ["drafts"] as const,
  connectors: ["connectors"] as const,
  telegramAuth: ["connectors", "telegram", "auth"] as const,
  telegramQrAuth: ["connectors", "telegram", "auth", "qr"] as const,
  captures: ["captures"] as const,
  setting: (key: string) => ["settings", key] as const,
  ollamaModels: ["ollama", "models"] as const,
  search: (q: string) => ["search", q] as const,
};
