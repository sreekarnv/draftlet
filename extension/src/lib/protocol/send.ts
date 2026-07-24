import {
  captureGmailResponseSchema,
  extractGmailResponseSchema,
  insertGmailDraftResponseSchema,
  latestGmailDraftResponseSchema,
  MessageType,
  type CaptureRead,
  type GmailCapturePayload,
  type LatestGmailDraft,
} from "./messages";
import { ExtensionError, type ErrorPayload } from "./responses";

async function sendTabMessage(tabId: number, message: unknown): Promise<unknown> {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    throw new ExtensionError("CONTENT_SCRIPT_UNAVAILABLE", "Open or reload Gmail, then try again.");
  }
}

type UnwrapResponseArgs<T> = { ok: true; result: T } | { ok: false; error: ErrorPayload };

function unwrapResponse<T>(response: UnwrapResponseArgs<T>): T {
  if (response.ok) return response.result;

  throw new ExtensionError(response.error.code, response.error.message, response.error.status);
}

export async function sendExtractGmail(tabId: number): Promise<GmailCapturePayload> {
  const response = await sendTabMessage(tabId, {
    type: MessageType.ExtractGmail,
  });

  const result = extractGmailResponseSchema.safeParse(response);

  if (!result.success)
    throw new ExtensionError("INVALID_MESSAGE", "Gmail capture returned an invalid response.");

  if (!result.data.ok)
    throw new ExtensionError(
      result.data.error.code,
      result.data.error.message,
      result.data.error.status,
    );

  return result.data.payload;
}

export async function sendCaptureGmail(payload: GmailCapturePayload): Promise<CaptureRead> {
  const response: unknown = await chrome.runtime.sendMessage({
    type: MessageType.CaptureGmail,
    payload,
  });

  const result = captureGmailResponseSchema.safeParse(response);

  if (!result.success)
    throw new ExtensionError(
      "INVALID_MESSAGE",
      "Draftlet runtime returned an invalid capture response.",
    );

  return unwrapResponse(result.data);
}

export async function sendGetLatestGmailDraft(): Promise<LatestGmailDraft> {
  const response: unknown = await chrome.runtime.sendMessage({
    type: MessageType.GetLatestGmailDraft,
  });

  const result = latestGmailDraftResponseSchema.safeParse(response);

  if (!result.success)
    throw new ExtensionError(
      "INVALID_MESSAGE",
      "Draftlet runtime returned an invalid draft response.",
    );

  return unwrapResponse(result.data);
}

export async function sendInsertGmailDraft(tabId: number, text: string): Promise<true> {
  const response = await sendTabMessage(tabId, {
    type: MessageType.InsertGmailDraft,
    payload: { text },
  });

  const result = insertGmailDraftResponseSchema.safeParse(response);

  if (!result.success)
    throw new ExtensionError(
      "INVALID_MESSAGE",
      "Gmail draft insertion returned an invalid response.",
    );

  return unwrapResponse(result.data);
}
