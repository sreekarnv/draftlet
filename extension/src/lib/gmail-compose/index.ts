import { ExtensionError } from "@/lib/protocol";

import { findComposeEditor } from "./editor";
import { insertText } from "./insert";

export function insertGmailDraft(text: string): true {
  const editor = findComposeEditor();
  if (!editor) {
    throw new ExtensionError("NO_COMPOSE_EDITOR", "Open a Gmail reply or compose box first.");
  }

  insertText(editor, text);
  return true;
}
