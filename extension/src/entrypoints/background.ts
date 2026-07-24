import {
	captureGmailMessageSchema,
	getLatestGmailDraftMessageSchema,
	toErrorPayload,
} from '@/lib/protocol';
import { captureGmail, latestGmailDraft } from '@/lib/runtime-client';

export default defineBackground(() => {
	chrome.runtime.onMessage.addListener(
		(message: unknown, _sender, sendResponse) => {
			const captureMessage = captureGmailMessageSchema.safeParse(message);
			if (captureMessage.success) {
				respondAsync(captureGmail(captureMessage.data.payload), sendResponse);

				return true;
			}

			const latestDraftMessage =
				getLatestGmailDraftMessageSchema.safeParse(message);

			if (latestDraftMessage.success) {
				respondAsync(latestGmailDraft(), sendResponse);

				return true;
			}

			return false;
		},
	);

	chrome.runtime.onInstalled.addListener(() => {
		void injectIntoOpenGmailTabs();
	});

	chrome.runtime.onStartup.addListener(() => {
		void injectIntoOpenGmailTabs();
	});
});

function respondAsync<T>(
	promise: Promise<T>,
	sendResponse: (response?: unknown) => void,
): void {
	void promise
		.then((result) => sendResponse({ ok: true, result }))
		.catch((error: unknown) =>
			sendResponse({ ok: false, error: toErrorPayload(error) }),
		);
}

async function injectIntoOpenGmailTabs(): Promise<void> {
	const contentScriptFile = gmailContentScriptFile();
	if (!contentScriptFile) return;

	const tabs = await chrome.tabs.query({ url: 'https://mail.google.com/*' });
	await Promise.allSettled(
		tabs.map((tab) => {
			if (!tab.id) return Promise.resolve();
			return chrome.scripting.executeScript({
				target: { tabId: tab.id },
				files: [contentScriptFile],
			});
		}),
	);
}

function gmailContentScriptFile(): string | undefined {
	return chrome.runtime
		.getManifest()
		.content_scripts?.find((script) =>
			script.matches?.includes('https://mail.google.com/*'),
		)?.js?.[0];
}
