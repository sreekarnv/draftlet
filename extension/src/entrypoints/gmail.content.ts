import { extractGmailCapture } from '@/lib/gmail-capture';
import { insertGmailDraft } from '@/lib/gmail-compose';
import {
	extractGmailMessageSchema,
	insertGmailDraftMessageSchema,
	toErrorPayload,
} from '@/lib/protocol';

export default defineContentScript({
	matches: ['https://mail.google.com/*'],
	runAt: 'document_idle',
	main() {
		chrome.runtime.onMessage.addListener(
			(message: unknown, _sender, sendResponse) => {
				try {
					if (extractGmailMessageSchema.safeParse(message).success) {
						sendResponse({ ok: true, payload: extractGmailCapture() });
						return false;
					}

					const insertMessage =
						insertGmailDraftMessageSchema.safeParse(message);
					if (insertMessage.success) {
						insertGmailDraft(insertMessage.data.payload.text);
						sendResponse({ ok: true, result: true });
						return false;
					}
				} catch (error: unknown) {
					sendResponse({ ok: false, error: toErrorPayload(error) });
					return false;
				}

				return false;
			},
		);
	},
});
