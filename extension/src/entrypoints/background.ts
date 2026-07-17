import {
  captureGmail,
  errorMessage,
  latestGmailDraft,
  type CaptureGmailMessage,
  type GetLatestGmailDraftMessage,
} from "@/lib/runtime";

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (isCaptureGmailMessage(message)) {
      void captureGmail(message.payload)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: unknown) => sendResponse({ ok: false, error: errorMessage(error) }));

      return true;
    }

    if (isGetLatestGmailDraftMessage(message)) {
      void latestGmailDraft()
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: unknown) => sendResponse({ ok: false, error: errorMessage(error) }));

      return true;
    }

    return false;
  });
});

function isCaptureGmailMessage(message: unknown): message is CaptureGmailMessage {
  return Boolean(
    message &&
      typeof message === "object" &&
      "type" in message &&
      message.type === "draftlet.captureGmail" &&
      "payload" in message,
  );
}

function isGetLatestGmailDraftMessage(message: unknown): message is GetLatestGmailDraftMessage {
  return Boolean(
    message &&
      typeof message === "object" &&
      "type" in message &&
      message.type === "draftlet.getLatestGmailDraft",
  );
}
