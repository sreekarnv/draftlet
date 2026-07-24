const COMPOSE_SELECTORS = [
  'div[role="textbox"][contenteditable="true"]',
  '.Am.Al.editable[contenteditable="true"]',
  'div[aria-label="Message Body"][contenteditable="true"]',
] as const;

export function findComposeEditor(): HTMLElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLElement && isComposeEditor(active)) {
    return active;
  }

  const candidates = uniqueElements(
    COMPOSE_SELECTORS.flatMap((selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)),
    ),
  ).filter((element) => isComposeEditor(element) && isVisible(element));

  return candidates.sort((a, b) => editorScore(b) - editorScore(a))[0] ?? null;
}

function editorScore(element: HTMLElement): number {
  let score = 0;
  if (element.getAttribute("role") === "textbox") score += 20;
  if (element.matches('.Am.Al.editable[contenteditable="true"]')) score += 10;
  if (element.getAttribute("aria-label") === "Message Body") score += 5;
  if (isVisible(element)) score += 1;
  return score;
}

function isComposeEditor(element: HTMLElement): boolean {
  return (
    element.isContentEditable &&
    (element.getAttribute("role") === "textbox" ||
      element.matches('.Am.Al.editable[contenteditable="true"]'))
  );
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function uniqueElements(elements: HTMLElement[]): HTMLElement[] {
  return Array.from(new Set(elements));
}
