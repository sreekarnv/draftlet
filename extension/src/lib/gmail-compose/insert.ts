import { ExtensionError } from "@/lib/protocol";

export function insertText(editor: HTMLElement, text: string): void {
  editor.focus();

  if (insertWithSelection(editor, text)) {
    dispatchInput(editor, text);
    return;
  }

  throw new ExtensionError(
    "NO_COMPOSE_EDITOR",
    "Click into the Gmail compose box, then try inserting again.",
  );
}

function insertWithSelection(editor: HTMLElement, text: string): boolean {
  const selection = window.getSelection();
  if (!selection) return false;

  const range = rangeForEditor(editor, selection);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);

  return true;
}

function rangeForEditor(editor: HTMLElement, selection: Selection): Range {
  if (selection.rangeCount) {
    const range = selection.getRangeAt(0);
    if (rangeBelongsToEditor(editor, range)) return range;
  }

  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  return range;
}

function rangeBelongsToEditor(editor: HTMLElement, range: Range): boolean {
  const container = range.commonAncestorContainer;
  return editor.contains(
    container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement,
  );
}

function dispatchInput(editor: HTMLElement, text: string): void {
  editor.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: text,
    }),
  );
}
