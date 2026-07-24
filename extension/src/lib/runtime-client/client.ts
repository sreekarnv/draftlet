import {
  captureReadSchema,
  latestGmailDraftSchema,
  type CaptureRead,
  type GmailCapturePayload,
  type LatestGmailDraft,
} from "@/lib/protocol";

import { RUNTIME_BASE_URLS, RUNTIME_ENDPOINTS } from "./config";
import { RuntimeError } from "./errors";

const runtimeAuthToken = import.meta.env.VITE_DRAFTLET_RUNTIME_TOKEN as string | undefined;

export async function captureGmail(payload: GmailCapturePayload): Promise<CaptureRead> {
  const response = await runtimeFetch(RUNTIME_ENDPOINTS.captureGmail, {
    method: "POST",
    headers: runtimeHeaders(true),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await errorFromResponse(response, "Draftlet runtime rejected the capture.");
  }

  return captureReadSchema.parse(await response.json());
}

export async function latestGmailDraft(): Promise<LatestGmailDraft> {
  const response = await runtimeFetch(RUNTIME_ENDPOINTS.latestGmailDraft, {
    headers: runtimeHeaders(false),
  });

  if (!response.ok) {
    throw await errorFromResponse(
      response,
      "No Gmail draft found. Generate one in Draftlet first.",
    );
  }

  return latestGmailDraftSchema.parse(await response.json());
}

function runtimeHeaders(hasBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (hasBody) headers["Content-Type"] = "application/json";
  if (runtimeAuthToken) headers["X-Draftlet-Runtime-Token"] = runtimeAuthToken;
  return headers;
}

async function runtimeFetch(path: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown;

  for (const baseUrl of RUNTIME_BASE_URLS) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(8000),
      });

      if (response.status >= 500 && baseUrl !== RUNTIME_BASE_URLS.at(-1)) {
        lastError = new RuntimeError(
          "RUNTIME_HTTP",
          `Draftlet runtime returned ${response.status}.`,
          response.status,
        );
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof DOMException && lastError.name === "TimeoutError") {
    throw new RuntimeError("RUNTIME_TIMEOUT", "Draftlet runtime timed out.");
  }
  throw new RuntimeError("RUNTIME_OFFLINE", "Draftlet runtime is offline.");
}

async function errorFromResponse(response: Response, fallback: string): Promise<RuntimeError> {
  const message = await responseDetail(response, fallback);
  if (response.status === 401 || response.status === 403) {
    return new RuntimeError("RUNTIME_UNAUTHORIZED", message, response.status);
  }
  if (response.status === 404) {
    return new RuntimeError("DRAFT_NOT_FOUND", message, response.status);
  }
  return new RuntimeError("RUNTIME_HTTP", message, response.status);
}

async function responseDetail(response: Response, fallback: string): Promise<string> {
  const text = await response.text().catch(() => "");
  if (!text) return fallback;

  try {
    const parsed = JSON.parse(text) as { detail?: unknown; message?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    return text;
  }

  return fallback;
}
