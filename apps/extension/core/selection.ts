export interface PageSelection {
  text: string;
  rect: DOMRect;
}

export function getPageSelection(candidate: EventTarget | null = document.activeElement): PageSelection | null {
  const selection = window.getSelection();

  if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
    const text = selection.toString().trim();

    if (text) {
      const range = selection.getRangeAt(0);
      const rect = getRangeRect(range);

      if (rect) {
        return { text, rect };
      }
    }
  }

  return getTextControlSelection(candidate);
}

function getTextControlSelection(candidate: EventTarget | null): PageSelection | null {
  if (!(candidate instanceof HTMLTextAreaElement || candidate instanceof HTMLInputElement)) {
    return null;
  }

  const start = candidate.selectionStart;
  const end = candidate.selectionEnd;

  if (typeof start !== 'number' || typeof end !== 'number' || start === end) {
    return null;
  }

  const text = candidate.value.slice(Math.min(start, end), Math.max(start, end)).trim();

  if (!text) {
    return null;
  }

  return { text, rect: candidate.getBoundingClientRect() };
}

function getRangeRect(range: Range): DOMRect | null {
  const rangeRect = range.getBoundingClientRect();

  if (rangeRect.width > 0 || rangeRect.height > 0) {
    return rangeRect;
  }

  const firstRect = range.getClientRects()[0];
  return firstRect ?? null;
}
