export const RUNTIME_BASE_URLS = ["http://127.0.0.1:8000", "http://127.0.0.1:8765"] as const;

export const RUNTIME_ENDPOINTS = {
  captureGmail: "/api/v1/connectors/gmail/captures",
  latestGmailDraft: "/api/v1/connectors/gmail/drafts/latest",
} as const;

export const RUNTIME_DISPLAY_HOSTS = RUNTIME_BASE_URLS.map((url) => url.replace("http://", ""));
