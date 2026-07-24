const runtimeBaseUrls = ['http://127.0.0.1:8765', 'http://127.0.0.1:8000'];
export const RUNTIME_CAPTURE_URL = `${runtimeBaseUrls[0]}/api/v1/connectors/gmail/captures`;
export const RUNTIME_LATEST_GMAIL_DRAFT_URL = `${runtimeBaseUrls[0]}/api/v1/connectors/gmail/drafts/latest`;
const runtimeAuthToken = import.meta.env.VITE_DRAFTLET_RUNTIME_TOKEN as
	| string
	| undefined;

export type GmailCapturePayload = {
	gmail_message_id: string;
	gmail_thread_id?: string;
	subject: string;
	sender: string;
	to: string[];
	cc: string[];
	bcc: string[];
	body: string;
	body_format: 'plain';
	gmail_url: string;
	timestamp?: string;
	metadata: Record<string, unknown>;
};

export type CaptureRead = {
	id: string;
	connector_kind: string;
	source_message_id: string;
	external_thread_id: string | null;
	external_message_id: string | null;
	conversation_id: string | null;
	message_id: string | null;
	status: string;
	captured_at: string;
};

export type LatestGmailDraft = {
	draft_id: string;
	conversation_id: string;
	subject: string;
	text: string;
	gmail_url?: string | null;
	updated_at: string;
};

export type ExtractGmailMessage = {
	type: 'draftlet.extractGmail';
};

export type CaptureGmailMessage = {
	type: 'draftlet.captureGmail';
	payload: GmailCapturePayload;
};

export type GetLatestGmailDraftMessage = {
	type: 'draftlet.getLatestGmailDraft';
};

export type InsertGmailDraftMessage = {
	type: 'draftlet.insertGmailDraft';
	payload: {
		text: string;
	};
};

export type RuntimeMessage =
	| ExtractGmailMessage
	| CaptureGmailMessage
	| GetLatestGmailDraftMessage
	| InsertGmailDraftMessage;

export type RuntimeResponse<T> =
	| {
			ok: true;
			result: T;
	  }
	| {
			ok: false;
			error: string;
	  };

export async function captureGmail(
	payload: GmailCapturePayload,
): Promise<CaptureRead> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};
	if (runtimeAuthToken) {
		headers['X-Draftlet-Runtime-Token'] = runtimeAuthToken;
	}

	const response = await runtimeFetch('/api/v1/connectors/gmail/captures', {
		method: 'POST',
		headers,
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const detail = await response.text().catch(() => '');
		throw new Error(detail || `Draftlet runtime returned ${response.status}`);
	}

	return response.json() as Promise<CaptureRead>;
}

export async function latestGmailDraft(): Promise<LatestGmailDraft> {
	const headers: Record<string, string> = {};
	if (runtimeAuthToken) {
		headers['X-Draftlet-Runtime-Token'] = runtimeAuthToken;
	}

	const response = await runtimeFetch(
		'/api/v1/connectors/gmail/drafts/latest',
		{ headers },
	);

	if (!response.ok) {
		const detail = await response.text().catch(() => '');
		throw new Error(detail || `Draftlet runtime returned ${response.status}`);
	}

	return response.json() as Promise<LatestGmailDraft>;
}

async function runtimeFetch(
	path: string,
	init?: RequestInit,
): Promise<Response> {
	let lastError: unknown;
	for (const baseUrl of runtimeBaseUrls) {
		try {
			return await fetch(`${baseUrl}${path}`, init);
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError;
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
