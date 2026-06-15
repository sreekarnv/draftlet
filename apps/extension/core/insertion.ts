import type { InsertionResult } from './types';
import type { FocusSnapshot } from './focus';
import { isTextInput } from './focus';

export type InsertionTargetAvailability = 'live' | 'stale' | 'unavailable';

export interface InsertionTargetResolution {
  availability: InsertionTargetAvailability;
  reason?: 'target_missing' | 'target_stale' | 'target_unreadable';
}

export async function insertReply(text: string, target: FocusSnapshot | null): Promise<InsertionResult> {
  const resolution = resolveTarget(target);

  if (resolution.availability === 'live' && target && tryInsert(text, target)) {
    return { status: 'inserted', message: 'Inserted', targetStatus: 'live' };
  }

  try {
    await navigator.clipboard.writeText(text);
    return {
      status: 'copied',
      message: resolution.availability === 'stale'
        ? 'Target was stale; copied instead.'
        : resolution.availability === 'unavailable'
          ? 'No insertion target; copied instead.'
          : 'Insertion failed; copied instead.',
      targetStatus: resolution.availability === 'live' ? 'needs_recapture' : resolution.availability,
      errorCode: errorCodeForResolution(resolution),
    };
  } catch {
    return {
      status: 'failed',
      message: 'Insert failed',
      targetStatus: resolution.availability === 'live' ? 'unavailable' : resolution.availability,
      errorCode: `${errorCodeForResolution(resolution)}_clipboard_failed`,
    };
  }
}

export function resolveTarget(target: FocusSnapshot | null): InsertionTargetResolution {
  if (!target) {
    return { availability: 'unavailable', reason: 'target_missing' };
  }

  const { element } = target;

  if (!element.isConnected) {
    return { availability: 'unavailable', reason: 'target_stale' };
  }

  if (element instanceof HTMLInputElement) {
    if (element.disabled || element.readOnly || !isTextInput(element)) {
      return { availability: 'unavailable', reason: 'target_stale' };
    }
    return { availability: 'live' };
  }

  if (element instanceof HTMLTextAreaElement) {
    if (element.disabled || element.readOnly) {
      return { availability: 'unavailable', reason: 'target_stale' };
    }
    return { availability: 'live' };
  }

  if (element instanceof HTMLElement) {
    if (
      element.getAttribute('aria-disabled') === 'true'
      || element.getAttribute('aria-readonly') === 'true'
    ) {
      return { availability: 'unavailable', reason: 'target_stale' };
    }
    return { availability: 'live' };
  }

  return { availability: 'unavailable', reason: 'target_unreadable' };
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
  if (element.isContentEditable) {
    return true;
  }

  const value = element.getAttribute('contenteditable');

  if (value === 'true' || value === 'plaintext-only') {
    return true;
  }

  const role = element.getAttribute('role');
  return role === 'textbox' || role === 'combobox';
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

function errorCodeForResolution(resolution: InsertionTargetResolution): string {
  if (resolution.availability === 'stale') {
    return 'target_stale';
  }

  if (resolution.availability === 'unavailable') {
    return 'target_missing';
  }

  return 'target_unreadable';
}
