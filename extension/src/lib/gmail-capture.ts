import type { GmailCapturePayload } from '@/lib/runtime';

export function extractGmailCapture(): GmailCapturePayload {
	const selection = window.getSelection();
	const body = selection?.toString().replace(/\s+/g, ' ').trim() || '';

	if (!body) {
		throw new Error(
			'Select the Gmail text you want Draftlet to capture, then try again.',
		);
	}

	const subject = textFrom(document.querySelector('h2.hP')) || 'Untitled email';
	const messageNodes = Array.from(
		document.querySelectorAll<HTMLElement>('.adn.ads'),
	);
	const messageNode =
		selectedMessageNode(selection) ||
		messageNodes.find((node) => isVisible(node));
	const senderNode = messageNode?.querySelector<HTMLElement>(
		'.gD[email], .go[email]',
	);
	const sender =
		senderNode?.getAttribute('email') ||
		senderNode?.getAttribute('name') ||
		textFrom(senderNode);
	const timestamp =
		messageNode?.querySelector('.g3')?.getAttribute('title') || undefined;
	const url = window.location.href;
	const gmailThreadId = threadIdFromUrl(url) || stableId(`${subject}:${url}`);
	const gmailMessageId =
		messageIdFromNode(messageNode) || stableId(`${gmailThreadId}:${body}`);

	return {
		gmail_message_id: gmailMessageId,
		gmail_thread_id: gmailThreadId,
		subject,
		sender: sender || 'Unknown',
		to: recipientsFrom(messageNode),
		cc: [],
		bcc: [],
		body,
		body_format: 'plain',
		gmail_url: url,
		timestamp: parseGmailTimestamp(timestamp),
		metadata: {
			capture_source: 'gmail-extension-selection',
			message_count: messageNodes.length,
			page_title: document.title,
			selection_length: body.length,
			selector_strategy: messageNode
				? 'selection-nearest-message'
				: 'page-fallback',
		},
	};
}

function textFrom(node: Element | null | undefined): string {
	return node?.textContent?.replace(/\s+/g, ' ').trim() || '';
}

function isVisible(node: HTMLElement): boolean {
	const rect = node.getBoundingClientRect();
	return rect.width > 0 && rect.height > 0;
}

function selectedMessageNode(
	selection: Selection | null,
): HTMLElement | undefined {
	const anchorNode = selection?.anchorNode;
	if (!anchorNode) return undefined;
	const element =
		anchorNode.nodeType === Node.ELEMENT_NODE
			? (anchorNode as Element)
			: anchorNode.parentElement;
	return element?.closest<HTMLElement>('.adn.ads') || undefined;
}

function threadIdFromUrl(url: string): string | undefined {
	const match = url.match(/(?:inbox|sent|all|search|label\/[^/]+)\/([^/?#]+)/);
	return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function messageIdFromNode(node: HTMLElement | undefined): string | undefined {
	const legacyMessageId = node
		?.querySelector('[data-legacy-message-id]')
		?.getAttribute('data-legacy-message-id');
	if (legacyMessageId) return legacyMessageId;
	const messageId = node?.getAttribute('data-message-id') || node?.id;
	return messageId || undefined;
}

function recipientsFrom(messageNode: HTMLElement | undefined): string[] {
	const nodes = Array.from(
		messageNode?.querySelectorAll<HTMLElement>(
			'.g2[email], .gD[email], .go[email]',
		) ?? [],
	);
	return Array.from(
		new Set(
			nodes
				.map((node) => node.getAttribute('email') || textFrom(node))
				.filter((value): value is string =>
					Boolean(value && value.includes('@')),
				),
		),
	);
}

function parseGmailTimestamp(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function stableId(value: string): string {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash << 5) - hash + value.charCodeAt(index);
		hash |= 0;
	}
	return `gmail-dom-${Math.abs(hash)}`;
}
