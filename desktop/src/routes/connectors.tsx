import { useState } from "react";

import { useCaptureMutation, useCapturesQuery } from "@/lib/queries/captures";
import { useConnectorsQuery, useUpdateConnector } from "@/lib/queries/connectors";
import type { CaptureCreate } from "@/lib/runtime-client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { SectionCard } from "@/shared/components/ui/section-card";

const initialCapture: CaptureCreate = {
  connector_kind: "gmail",
  source_message_id: "",
  title: "",
  contact: "",
  participants: "",
  body: "",
  author: "Unknown",
};

export function Connectors() {
  const connectors = useConnectorsQuery();
  const captures = useCapturesQuery();
  const updateConnector = useUpdateConnector();
  const capture = useCaptureMutation();
  const [form, setForm] = useState<CaptureCreate>(initialCapture);

  function updateForm<K extends keyof CaptureCreate>(key: K, value: CaptureCreate[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitCapture() {
    await capture.mutateAsync(form);
    setForm({ ...initialCapture, connector_kind: form.connector_kind });
  }

  const canSubmit = Boolean(form.source_message_id && form.title && form.contact && form.body);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5 overflow-auto px-6 py-6">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Local and external inputs
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Connectors</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Review connector rows and manually capture messages while the Gmail and Telegram producers are still being built.
        </p>
      </header>

      <SectionCard title="Configured connectors" description="Rows currently persisted in the runtime database.">
        {connectors.data?.length ? (
          <div className="divide-y divide-border rounded-lg border">
            {connectors.data.map((connector) => (
              <div key={connector.id} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{connector.name}</p>
                  <p className="text-xs text-muted-foreground">{connector.kind}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => updateConnector.mutate({ id: connector.id, patch: { enabled: !connector.enabled } })}
                >
                  {connector.enabled ? "Disable" : "Enable"}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No connector rows yet. Manual captures can still be ingested.</p>
        )}
      </SectionCard>

      <SectionCard title="Manual capture" description="Create a conversation from a captured Gmail or Telegram message.">
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Connector
            <select
              value={form.connector_kind}
              onChange={(event) => updateForm("connector_kind", event.target.value as CaptureCreate["connector_kind"])}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="gmail">Gmail</option>
              <option value="telegram">Telegram</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Source message id
            <Input value={form.source_message_id} onChange={(event) => updateForm("source_message_id", event.target.value)} placeholder="gmail-message-123" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Title
            <Input value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="Follow up on proposal" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Contact
            <Input value={form.contact} onChange={(event) => updateForm("contact", event.target.value)} placeholder="Avery" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Author
            <Input value={form.author ?? ""} onChange={(event) => updateForm("author", event.target.value)} placeholder="Avery" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Participants
            <Input value={form.participants ?? ""} onChange={(event) => updateForm("participants", event.target.value)} placeholder="Avery, Sreekar" />
          </label>
          <label className="flex flex-col gap-1 text-sm lg:col-span-2">
            Body
            <textarea
              value={form.body}
              onChange={(event) => updateForm("body", event.target.value)}
              placeholder="Paste the captured message body"
              className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" size="sm" disabled={!canSubmit || capture.isPending} onClick={() => void submitCapture()}>
            {capture.isPending ? "Capturing..." : "Capture message"}
          </Button>
          {capture.isSuccess ? <span className="text-xs text-muted-foreground">Captured</span> : null}
          {capture.isError ? <span className="text-xs text-destructive">Capture failed</span> : null}
        </div>
      </SectionCard>

      <SectionCard title="Recent captures" description="Latest capture events accepted by the local runtime.">
        {captures.data?.length ? (
          <div className="divide-y divide-border rounded-lg border">
            {captures.data.map((item) => (
              <div key={item.id} className="grid gap-1 px-3 py-2 text-sm md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="font-medium">{item.connector_kind}:{item.source_message_id}</p>
                  <p className="text-xs text-muted-foreground">status: {item.status}</p>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(item.captured_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No captures yet.</p>
        )}
      </SectionCard>
    </section>
  );
}
