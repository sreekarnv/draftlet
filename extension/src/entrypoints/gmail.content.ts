import { extractGmailCapture } from "@/lib/gmail-capture";
import { errorMessage } from "@/lib/runtime";

export default defineContentScript({
  matches: ["https://mail.google.com/*"],
  runAt: "document_idle",
  main() {
    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      try {
        if (isExtractGmailMessage(message)) {
          sendResponse({ ok: true, payload: extractGmailCapture() });
          return false;
        }

        if (isInsertGmailDraftMessage(message)) {
          insertIntoGmailCompose(message.payload.text);
          sendResponse({ ok: true, result: true });
          return false;
        }
      } catch (error: unknown) {
        sendResponse({ ok: false, error: errorMessage(error) });
        return false;
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

function isInsertGmailDraftMessage(
  message: unknown,
): message is { type: "draftlet.insertGmailDraft"; payload: { text: string } } {
  return Boolean(
    message &&
      typeof message === "object" &&
      "type" in message &&
      message.type === "draftlet.insertGmailDraft" &&
      "payload" in message &&
      message.payload &&
      typeof message.payload === "object" &&
      "text" in message.payload &&
      typeof message.payload.text === "string",
  );
}

function insertIntoGmailCompose(text: string) {
  const editor = findComposeEditor();
  if (!editor) {
    throw new Error("Open a Gmail reply or compose box first.");
  }

  editor.focus();
  const inserted = document.execCommand("insertText", false, text);
  if (!inserted) {
    editor.textContent = text;
  }

  editor.dispatchEvent(
    new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }),
  );
}

function findComposeEditor(): HTMLElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLElement && isComposeEditor(active)) {
    return active;
  }

  const selectors = [
    'div[role="textbox"][contenteditable="true"]',
    'div[aria-label="Message Body"][contenteditable="true"]',
    ".Am.Al.editable[contenteditable=\"true\"]",
  ];
  const candidates = selectors.flatMap((selector) =>
    Array.from(document.querySelectorAll<HTMLElement>(selector)),
  );
  return candidates.filter(isVisible).at(-1) ?? null;
}

function isComposeEditor(element: HTMLElement): boolean {
  return (
    element.isContentEditable &&
    (element.getAttribute("role") === "textbox" || isVisible(element))
  );
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
