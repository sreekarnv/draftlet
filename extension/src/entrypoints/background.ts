import { captureGmail, errorMessage, type CaptureGmailMessage } from "@/lib/runtime";

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isCaptureGmailMessage(message)) {
      return false;
    }

    void captureGmail(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error: unknown) => sendResponse({ ok: false, error: errorMessage(error) }));

    return true;
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
