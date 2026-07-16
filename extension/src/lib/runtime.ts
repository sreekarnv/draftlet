export const RUNTIME_CAPTURE_URL = "http://127.0.0.1:8000/api/v1/connectors/gmail/captures";

export type GmailCapturePayload = {
  gmail_message_id: string;
  gmail_thread_id?: string;
  subject: string;
  sender: string;
  to: string[];
  cc: string[];
  bcc: string[];
  body: string;
  body_format: "plain";
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

export type ExtractGmailMessage = {
  type: "draftlet.extractGmail";
};

export type CaptureGmailMessage = {
  type: "draftlet.captureGmail";
  payload: GmailCapturePayload;
};

export type RuntimeMessage = ExtractGmailMessage | CaptureGmailMessage;

export type RuntimeResponse<T> =
  | {
      ok: true;
      result: T;
    }
  | {
      ok: false;
      error: string;
    };

export async function captureGmail(payload: GmailCapturePayload): Promise<CaptureRead> {
  const response = await fetch(RUNTIME_CAPTURE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Draftlet runtime returned ${response.status}`);
  }

  return response.json() as Promise<CaptureRead>;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
