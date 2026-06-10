import type { InsertionResult } from './types';
import type { FocusSnapshot } from './focus';
import { isTextInput } from './focus';

export async function insertReply(text: string, target: FocusSnapshot | null): Promise<InsertionResult> {
  if (target && tryInsert(text, target)) {
    return { status: 'inserted', message: 'Inserted', targetStatus: 'live' };
  }

  try {
    await navigator.clipboard.writeText(text);
    return {
      status: 'copied',
      message: target ? 'Target was stale; copied instead.' : 'No insertion target; copied instead.',
      targetStatus: target ? 'stale' : 'needs_recapture',
      errorCode: target ? 'target_stale' : 'target_missing',
    };
  } catch {
    return {
      status: 'failed',
      message: 'Insert failed',
      targetStatus: target ? 'stale' : 'unavailable',
      errorCode: target ? 'target_stale_clipboard_failed' : 'target_missing_clipboard_failed',
    };
  }
}

function tryInsert(text: string, target: FocusSnapshot): boolean {
  const element = target.element;

  if (!element.isConnected) {
    return false;
  }

  if (element instanceof HTMLTextAreaElement) {
    return insertIntoTextControl(element, text, target);
  }

  if (element instanceof HTMLInputElement && isTextInput(element)) {
    return insertIntoTextControl(element, text, target);
  }

  if (element instanceof HTMLElement && isContentEditableElement(element)) {
    return insertIntoContentEditable(element, text, target.range);
  }

  return false;
}

function insertIntoTextControl(
  element: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  target: FocusSnapshot,
): boolean {
  if (element.disabled || element.readOnly) {
    return false;
  }

  const start = clampSelection(target.selectionStart, element.value.length);
  const end = clampSelection(target.selectionEnd, element.value.length);

  try {
    element.focus({ preventScroll: true });
    element.setRangeText(text, Math.min(start, end), Math.max(start, end), 'end');
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    return true;
  } catch {
    return false;
  }
}

function insertIntoContentEditable(element: HTMLElement, text: string, capturedRange?: Range): boolean {
  try {
    element.focus({ preventScroll: true });

    const selection = element.ownerDocument.getSelection();

    if (!selection) {
      return false;
    }

    const range = capturedRange && isRangeInside(element, capturedRange)
      ? capturedRange.cloneRange()
      : createEndRange(element);

    selection.removeAllRanges();
    selection.addRange(range);
    range.deleteContents();

    const textNode = element.ownerDocument.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    return true;
  } catch {
    return false;
  }
}

function createEndRange(element: HTMLElement): Range {
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  return range;
}

function isContentEditableElement(element: HTMLElement): boolean {
  return element.isContentEditable
    || element.getAttribute('contenteditable') === 'true'
    || element.getAttribute('contenteditable') === 'plaintext-only';
}

function isRangeInside(element: HTMLElement, range: Range): boolean {
  const container = range.commonAncestorContainer;
  const containerElement = container.nodeType === Node.ELEMENT_NODE
    ? container
    : container.parentElement;

  return !!containerElement && element.contains(containerElement);
}

function clampSelection(value: number | null | undefined, length: number): number {
  if (typeof value !== 'number') {
    return length;
  }

  return Math.min(Math.max(value, 0), length);
}
