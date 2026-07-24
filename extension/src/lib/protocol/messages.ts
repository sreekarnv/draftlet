import { z } from "zod";

import { errorPayloadSchema, responseSchema } from "./responses";

export const MessageType = {
  ExtractGmail: "draftlet.extractGmail",
  CaptureGmail: "draftlet.captureGmail",
  GetLatestGmailDraft: "draftlet.getLatestGmailDraft",
  InsertGmailDraft: "draftlet.insertGmailDraft",
} as const;

export const gmailCapturePayloadSchema = z.object({
  gmail_message_id: z.string().min(1),
  gmail_thread_id: z.string().optional(),
  subject: z.string(),
  sender: z.string(),
  to: z.array(z.string()),
  cc: z.array(z.string()),
  bcc: z.array(z.string()),
  body: z.string().min(1),
  body_format: z.literal("plain"),
  gmail_url: z.string(),
  timestamp: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()),
});

export const captureReadSchema = z.object({
  id: z.string(),
  connector_kind: z.string(),
  source_message_id: z.string(),
  external_thread_id: z.string().nullable(),
  external_message_id: z.string().nullable(),
  conversation_id: z.string().nullable(),
  message_id: z.string().nullable(),
  status: z.string(),
  captured_at: z.string(),
});

export const latestGmailDraftSchema = z.object({
  draft_id: z.string(),
  conversation_id: z.string(),
  subject: z.string(),
  text: z.string(),
  gmail_url: z.string().nullable().optional(),
  updated_at: z.string(),
});

export const extractGmailMessageSchema = z.object({
  type: z.literal(MessageType.ExtractGmail),
});

export const captureGmailMessageSchema = z.object({
  type: z.literal(MessageType.CaptureGmail),
  payload: gmailCapturePayloadSchema,
});

export const getLatestGmailDraftMessageSchema = z.object({
  type: z.literal(MessageType.GetLatestGmailDraft),
});

export const insertGmailDraftMessageSchema = z.object({
  type: z.literal(MessageType.InsertGmailDraft),
  payload: z.object({ text: z.string().min(1) }),
});

export const extractGmailResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), payload: gmailCapturePayloadSchema }),
  z.object({ ok: z.literal(false), error: errorPayloadSchema }),
]);

export const captureGmailResponseSchema = responseSchema(captureReadSchema);
export const latestGmailDraftResponseSchema = responseSchema(latestGmailDraftSchema);
export const insertGmailDraftResponseSchema = responseSchema(z.literal(true));

export type GmailCapturePayload = z.infer<typeof gmailCapturePayloadSchema>;
export type CaptureRead = z.infer<typeof captureReadSchema>;
export type LatestGmailDraft = z.infer<typeof latestGmailDraftSchema>;
export type ExtractGmailMessage = z.infer<typeof extractGmailMessageSchema>;
export type CaptureGmailMessage = z.infer<typeof captureGmailMessageSchema>;
export type GetLatestGmailDraftMessage = z.infer<typeof getLatestGmailDraftMessageSchema>;
export type InsertGmailDraftMessage = z.infer<typeof insertGmailDraftMessageSchema>;
