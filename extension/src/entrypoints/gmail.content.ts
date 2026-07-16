import { extractGmailCapture } from "@/lib/gmail-capture";
import { errorMessage } from "@/lib/runtime";

export default defineContentScript({
  matches: ["https://mail.google.com/*"],
  runAt: "document_idle",
  main() {
    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (!isExtractGmailMessage(message)) {
        return false;
      }

      try {
        sendResponse({ ok: true, payload: extractGmailCapture() });
      } catch (error: unknown) {
        sendResponse({ ok: false, error: errorMessage(error) });
      }

      return false;
    });
  },
});

function isExtractGmailMessage(message: unknown): boolean {
  return Boolean(
    message &&
      typeof message === "object" &&
      "type" in message &&
      message.type === "draftlet.extractGmail",
  );
}
