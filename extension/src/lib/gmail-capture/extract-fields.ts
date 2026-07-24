import { firstMatching, textFrom } from './dom';
import { GMAIL_SELECTORS } from './selectors';
import type { CaptureContext, FieldResult } from './types';

export function extractSubject(): FieldResult<string> {
	for (const selector of GMAIL_SELECTORS.subject) {
		const subject = textFrom(document.querySelector(selector));
		if (subject) return { value: subject, source: selector };
	}

	const title = titleSubject(document.title);
	if (title) return { value: title, source: 'document-title' };

	return { value: 'Untitled email', source: 'fallback' };
}

export function extractSender(context: CaptureContext): FieldResult<string> {
	const node = firstMatching<HTMLElement>(
		context.messageNode,
		GMAIL_SELECTORS.sender,
	);
	const sender =
		node?.getAttribute('email') ||
		node?.getAttribute('name') ||
		textFrom(node) ||
		'Unknown';

	return {
		value: sender,
		source: node ? 'sender-email-attr' : 'fallback',
	};
}

export function extractRecipients(
	context: CaptureContext,
): FieldResult<string[]> {
	const nodes = GMAIL_SELECTORS.recipients.flatMap((selector) =>
		Array.from(
			context.messageNode?.querySelectorAll<HTMLElement>(selector) ?? [],
		),
	);

	const recipients = Array.from(
		new Set(
			nodes
				.map((node) => node.getAttribute('email') || textFrom(node))
				.filter((value): value is string =>
					Boolean(value && value.includes('@')),
				),
		),
	);

	return {
		value: recipients,
		source: nodes.length ? 'recipient-email-attr' : 'missing',
	};
}

export function extractTimestamp(
	context: CaptureContext,
): FieldResult<string | undefined> {
	const node = firstMatching<HTMLElement>(
		context.messageNode,
		GMAIL_SELECTORS.timestamp,
	);
	const value = node?.getAttribute('title') || undefined;
	if (!value) return { value: undefined, source: 'missing' };

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return { value: undefined, source: 'unparsed-g3-title' };
	}

	return { value: date.toISOString(), source: 'g3-title' };
}

export function extractThreadId(
	url: string,
	subject: string,
): FieldResult<string> {
	const match = url.match(
		/#(?:inbox|sent|all|starred|important|snoozed|drafts|spam|trash|category\/[^/]+|label\/[^/]+|search\/[^/]+)\/([^/?#]+)/,
	);
	if (match?.[1]) {
		return { value: decodeURIComponent(match[1]), source: 'gmail-url-hash' };
	}

	return {
		value: stableId(`${subject}:${url}`),
		source: 'synthetic-thread-id',
	};
}

export function extractMessageId(
	context: CaptureContext,
	threadId: string,
): FieldResult<string> {
	const legacyMessageId = context.messageNode
		?.querySelector('[data-legacy-message-id]')
		?.getAttribute('data-legacy-message-id');
	if (legacyMessageId)
		return { value: legacyMessageId, source: 'legacy-message-id' };

	const messageId =
		context.messageNode?.getAttribute('data-message-id') ||
		context.messageNode?.id ||
		undefined;
	if (messageId) return { value: messageId, source: 'message-node-attr' };

	const index = context.messageNode
		? context.messageNodes.indexOf(context.messageNode)
		: -1;
	if (index >= 0)
		return { value: `${threadId}:${index}`, source: 'thread-message-index' };

	return {
		value: stableId(`${threadId}:${context.url}`),
		source: 'synthetic-message-id',
	};
}

function titleSubject(title: string): string {
	return title.replace(/\s+-\s+Gmail\s*$/i, '').trim();
}

function stableId(value: string): string {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash << 5) - hash + value.charCodeAt(index);
		hash |= 0;
	}
	return `gmail-dom-${Math.abs(hash)}`;
}
