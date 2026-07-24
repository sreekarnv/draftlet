import { isVisible, selectionElement } from './dom';
import { GMAIL_SELECTORS } from './selectors';
import type { MessageNodeMatch } from './types';

export function messageNodesFromPage(): HTMLElement[] {
	return Array.from(
		document.querySelectorAll<HTMLElement>(GMAIL_SELECTORS.messageContainer),
	);
}

export function selectedMessageNode(
	selection: Selection | null,
	messageNodes: HTMLElement[],
): MessageNodeMatch {
	const selected = selectionElement(selection)?.closest<HTMLElement>(
		GMAIL_SELECTORS.messageContainer,
	);
	if (selected) return { node: selected, source: 'selection-ancestor' };

	const fallback = messageNodes.find(isVisible);
	if (fallback) return { node: fallback, source: 'first-visible' };

	return { node: undefined, source: 'missing' };
}
