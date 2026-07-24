export function textFrom(node: Element | null | undefined): string {
  return node?.textContent?.replace(/[ \t\f\v]+/g, " ").trim() || "";
}

export function isVisible(node: HTMLElement): boolean {
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function selectionElement(selection: Selection | null): Element | undefined {
  const anchorNode = selection?.anchorNode;
  if (!anchorNode) return undefined;
  return anchorNode.nodeType === Node.ELEMENT_NODE
    ? (anchorNode as Element)
    : (anchorNode.parentElement ?? undefined);
}

export function firstMatching<T extends Element>(
  root: ParentNode | undefined,
  selectors: readonly string[],
): T | null {
  for (const selector of selectors) {
    const match = root?.querySelector<T>(selector);
    if (match) return match;
  }
  return null;
}
