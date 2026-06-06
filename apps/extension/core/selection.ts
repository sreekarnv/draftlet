export interface PageSelection {
  text: string;
  rect: DOMRect;
}

export function getPageSelection(): PageSelection | null {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const text = selection.toString().trim();

  if (!text) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rect = getRangeRect(range);

  if (!rect) {
    return null;
  }

  return { text, rect };
}

function getRangeRect(range: Range): DOMRect | null {
  const rangeRect = range.getBoundingClientRect();

  if (rangeRect.width > 0 || rangeRect.height > 0) {
    return rangeRect;
  }

  const firstRect = range.getClientRects()[0];
  return firstRect ?? null;
}
