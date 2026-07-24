import type { GmailCapturePayload } from '@/lib/protocol';

import {
	extractMessageId,
	extractRecipients,
	extractSender,
	extractSubject,
	extractThreadId,
	extractTimestamp,
} from './extract-fields';
import { messageNodesFromPage, selectedMessageNode } from './message-node';
import { selectedPlainText } from './selection';
import type { CaptureContext } from './types';

export function extractGmailCapture(): GmailCapturePayload {
	const selection = window.getSelection();
	const body = selectedPlainText(selection);
	const messageNodes = messageNodesFromPage();
	const match = selectedMessageNode(selection, messageNodes);
	const url = window.location.href;
	const fieldSources: Record<string, string> = {
		message_node: match.source,
	};

	const context: CaptureContext = {
		selection,
		body,
		url,
		messageNodes,
		messageNode: match.node,
		messageNodeSource: match.source,
		fieldSources,
	};

	const subject = extractSubject();
	fieldSources.subject = subject.source;

	const sender = extractSender(context);
	fieldSources.sender = sender.source;

	const recipients = extractRecipients(context);
	fieldSources.to = recipients.source;

	const timestamp = extractTimestamp(context);
	fieldSources.timestamp = timestamp.source;

	const threadId = extractThreadId(url, subject.value);
	fieldSources.gmail_thread_id = threadId.source;

	const messageId = extractMessageId(context, threadId.value);
	fieldSources.gmail_message_id = messageId.source;

	return {
		gmail_message_id: messageId.value,
		gmail_thread_id: threadId.value,
		subject: subject.value,
		sender: sender.value,
		to: recipients.value,
		cc: [],
		bcc: [],
		body,
		body_format: 'plain',
		gmail_url: url,
		timestamp: timestamp.value,
		metadata: {
			capture_source: 'gmail-extension-selection',
			message_count: messageNodes.length,
			page_title: document.title,
			selection_length: body.length,
			selector_strategy: match.source,
			field_sources: fieldSources,
		},
	};
}
