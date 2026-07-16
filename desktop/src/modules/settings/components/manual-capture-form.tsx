import { Controller, useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";

import { useCaptureMutation, useGmailCaptureMutation } from "@/lib/queries/captures";
import type { CaptureCreate } from "@/lib/runtime-client";
import { Button } from "@/shared/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";

const manualCaptureSchema = z.object({
  connector_kind: z.enum(["gmail", "telegram"]),
  source_message_id: z.string().trim().min(1, "Source message id is required."),
  external_thread_id: z.string().trim().optional(),
  external_message_id: z.string().trim().optional(),
  reply_to_external_message_id: z.string().trim().optional(),
  timestamp: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), {
      message: "Use an ISO timestamp like 2026-07-16T12:00:00Z.",
    }),
  title: z.string().trim().min(1, "Title is required."),
  contact: z.string().trim().min(1, "Contact is required."),
  author: z.string().trim().optional(),
  participants: z.string().trim().optional(),
  body: z.string().trim().min(1, "Body is required."),
});

type ManualCaptureValues = z.infer<typeof manualCaptureSchema>;

const defaultValues: ManualCaptureValues = {
  connector_kind: "gmail",
  source_message_id: "",
  external_thread_id: "",
  external_message_id: "",
  reply_to_external_message_id: "",
  timestamp: "",
  title: "",
  contact: "",
  author: "Unknown",
  participants: "",
  body: "",
};

export function ManualCaptureForm() {
  const capture = useCaptureMutation();
  const gmailCapture = useGmailCaptureMutation();
  const form = useForm<ManualCaptureValues>({
    resolver: standardSchemaResolver(manualCaptureSchema),
    mode: "onChange",
    defaultValues,
  });

  const connectorKind = form.watch("connector_kind");
  const pending = capture.isPending || gmailCapture.isPending;

  async function submit(values: ManualCaptureValues) {
    const externalThreadId = values.external_thread_id || undefined;
    const externalMessageId = values.external_message_id || undefined;
    const replyToExternalMessageId = values.reply_to_external_message_id || undefined;
    const timestamp = values.timestamp || undefined;

    if (values.connector_kind === "gmail") {
      await gmailCapture.mutateAsync({
        gmail_message_id: externalMessageId || values.source_message_id,
        gmail_thread_id: externalThreadId,
        reply_to_gmail_message_id: replyToExternalMessageId,
        subject: values.title,
        sender: values.contact,
        to: splitParticipants(values.participants),
        body: values.body,
        body_format: "plain",
        timestamp,
        metadata: { capture_source: "desktop-manual-gmail" },
      });
      form.reset({ ...defaultValues, connector_kind: values.connector_kind });
      return;
    }

    const payload: CaptureCreate = {
      connector_kind: values.connector_kind,
      source_message_id: values.source_message_id,
      external_thread_id: externalThreadId,
      external_message_id: externalMessageId,
      reply_to_external_message_id: replyToExternalMessageId,
      timestamp,
      metadata: undefined,
      title: values.title,
      contact: values.contact,
      participants: values.participants,
      body: values.body,
      author: values.author || "Unknown",
    };

    await capture.mutateAsync(payload);
    form.reset({ ...defaultValues, connector_kind: values.connector_kind });
  }

  return (
    <div id="manual-capture" className="scroll-mt-6">
      <h3 className="text-sm font-semibold">Manual capture</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Create a conversation from a captured Gmail or Telegram message while background producers
        are still evolving.
      </p>
      <form className="mt-3 space-y-4" onSubmit={form.handleSubmit(submit)}>
        <div className="grid gap-3 lg:grid-cols-2">
          <Controller
            control={form.control}
            name="connector_kind"
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel htmlFor="manual-connector-kind">Connector</FieldLabel>
                <select
                  id="manual-connector-kind"
                  value={field.value}
                  onChange={field.onChange}
                  aria-invalid={fieldState.invalid}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm aria-invalid:border-destructive"
                >
                  <option value="gmail">Gmail</option>
                  <option value="telegram">Telegram</option>
                </select>
                <FieldError>{fieldState.error?.message}</FieldError>
              </Field>
            )}
          />
          <TextField
            control={form.control}
            name="source_message_id"
            label="Source message id"
            placeholder={connectorKind === "gmail" ? "gmail-message-123" : "chat:123"}
          />
          {connectorKind === "gmail" ? (
            <>
              <TextField
                control={form.control}
                name="external_thread_id"
                label="Gmail thread id"
                placeholder="thread-a:r123"
              />
              <TextField
                control={form.control}
                name="external_message_id"
                label="Gmail message id"
                placeholder="msg-a:r456"
              />
              <TextField
                control={form.control}
                name="reply_to_external_message_id"
                label="Reply-to Gmail message id"
                placeholder="msg-a:r123"
              />
              <TextField
                control={form.control}
                name="timestamp"
                label="Timestamp"
                placeholder="2026-07-16T12:00:00Z"
              />
            </>
          ) : null}
          <TextField
            control={form.control}
            name="title"
            label="Title"
            placeholder="Follow up on proposal"
          />
          <TextField control={form.control} name="contact" label="Contact" placeholder="Avery" />
          <TextField control={form.control} name="author" label="Author" placeholder="Avery" />
          <TextField
            control={form.control}
            name="participants"
            label="Participants"
            placeholder="Avery, Sreekar"
          />
          <Controller
            control={form.control}
            name="body"
            render={({ field, fieldState }) => (
              <Field className="lg:col-span-2">
                <FieldLabel htmlFor="manual-body">Body</FieldLabel>
                <Textarea
                  id="manual-body"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Paste the captured message body"
                  aria-invalid={fieldState.invalid}
                  className="min-h-28"
                />
                <FieldError>{fieldState.error?.message}</FieldError>
              </Field>
            )}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={!form.formState.isValid || pending}>
            {pending ? "Capturing..." : "Capture message"}
          </Button>
          {capture.isSuccess || gmailCapture.isSuccess ? (
            <span className="text-xs text-muted-foreground">Captured</span>
          ) : null}
          {capture.isError || gmailCapture.isError ? (
            <span className="text-xs text-destructive">Capture failed</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function TextField({
  control,
  name,
  label,
  placeholder,
  description,
}: {
  control: ReturnType<typeof useForm<ManualCaptureValues>>["control"];
  name: keyof ManualCaptureValues;
  label: string;
  placeholder?: string;
  description?: string;
}) {
  const id = `manual-${name}`;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input
            id={id}
            value={String(field.value ?? "")}
            onChange={field.onChange}
            placeholder={placeholder}
            aria-invalid={fieldState.invalid}
          />
          {description ? <FieldDescription>{description}</FieldDescription> : null}
          <FieldError>{fieldState.error?.message}</FieldError>
        </Field>
      )}
    />
  );
}

function splitParticipants(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
