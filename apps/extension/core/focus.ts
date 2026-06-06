export interface FocusSnapshot {
  element: HTMLInputElement | HTMLTextAreaElement | HTMLElement;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  range?: Range;
}

export function captureFocusedTarget(candidate: EventTarget | null = document.activeElement): FocusSnapshot | null {
  if (!(candidate instanceof Element)) {
    return null;
  }

  if (candidate instanceof HTMLTextAreaElement) {
    return captureTextControl(candidate);
  }

  if (candidate instanceof HTMLInputElement && isTextInput(candidate)) {
    return captureTextControl(candidate);
  }

  const editable = getContentEditableElement(candidate);

  if (editable) {
    return {
      element: editable,
      range: getSelectionRangeInside(editable),
    };
  }

  return null;
}

export function isTextInput(element: HTMLInputElement): boolean {
  const textInputTypes = new Set([
    'email',
    'number',
    'password',
    'search',
    'tel',
    'text',
    'url',
  ]);

  return textInputTypes.has(element.type || 'text');
}

function captureTextControl(element: HTMLInputElement | HTMLTextAreaElement): FocusSnapshot {
  return {
    element,
    selectionStart: element.selectionStart,
    selectionEnd: element.selectionEnd,
  };
}

function getContentEditableElement(element: Element): HTMLElement | null {
  if (element instanceof HTMLElement && element.isContentEditable) {
    return element;
  }

  return element.closest<HTMLElement>('[contenteditable="true"], [contenteditable="plaintext-only"]');
}

function getSelectionRangeInside(element: HTMLElement): Range | undefined {
  const selection = element.ownerDocument.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return undefined;
  }

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const containerElement = container.nodeType === Node.ELEMENT_NODE
    ? container
    : container.parentElement;

  if (containerElement && element.contains(containerElement)) {
    return range.cloneRange();
  }

  return undefined;
}
