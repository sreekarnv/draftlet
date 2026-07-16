import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  useCaptureMutation,
  useCapturesQuery,
  useGmailCaptureMutation,
} from "@/lib/queries/captures";
import {
  useConnectorsQuery,
  useDisconnectTelegram,
  useTelegramAuthStatusQuery,
  useUpdateConnector,
} from "@/lib/queries/connectors";
import { useHealthQuery } from "@/lib/queries/health";
import { queryKeys } from "@/lib/queries/keys";
import { useOllamaModelsQuery } from "@/lib/queries/ollama";
import { useSettingQuery, useUpdateSetting } from "@/lib/queries/settings";
import { TelegramConnectModal } from "@/modules/connectors/components/telegram-connect-modal";
import type { CaptureCreate } from "@/lib/runtime-client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { SectionCard } from "@/shared/components/ui/section-card";

const OLLAMA_MODEL_KEY = "ollama_default_model";
const RUN_IN_BACKGROUND_KEY = "run_in_background";

const initialCapture: CaptureCreate = {
  connector_kind: "gmail",
  source_message_id: "",
  title: "",
  contact: "",
  participants: "",
  body: "",
  author: "Unknown",
};

export function Settings() {
  const modelSetting = useSettingQuery(OLLAMA_MODEL_KEY);
  const backgroundSetting = useSettingQuery(RUN_IN_BACKGROUND_KEY);
  const models = useOllamaModelsQuery();
  const connectors = useConnectorsQuery();
  const captures = useCapturesQuery();
  const telegramAuth = useTelegramAuthStatusQuery();
  const health = useHealthQuery();
  const updateSetting = useUpdateSetting();
  const updateConnector = useUpdateConnector();
  const disconnectTelegram = useDisconnectTelegram();
  const capture = useCaptureMutation();
  const gmailCapture = useGmailCaptureMutation();
  const queryClient = useQueryClient();

  const [model, setModel] = useState("");
  const [runInBackground, setRunInBackground] = useState(false);
  const [form, setForm] = useState<CaptureCreate>(initialCapture);
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);

  useEffect(() => {
    if (typeof modelSetting.data?.value === "string") {
      setModel(modelSetting.data.value);
    }
  }, [modelSetting.data?.value]);

  useEffect(() => {
    setRunInBackground(backgroundSetting.data?.value === true);
  }, [backgroundSetting.data?.value]);

  function updateForm<K extends keyof CaptureCreate>(key: K, value: CaptureCreate[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveModel() {
    await updateSetting.mutateAsync({ key: OLLAMA_MODEL_KEY, value: model });
  }

  async function saveRunInBackground(value: boolean) {
    setRunInBackground(value);
    await updateSetting.mutateAsync({ key: RUN_IN_BACKGROUND_KEY, value });
  }

  async function submitCapture() {
    const externalThreadId = form.external_thread_id?.trim() || undefined;
    const externalMessageId = form.external_message_id?.trim() || undefined;
    const replyToExternalMessageId = form.reply_to_external_message_id?.trim() || undefined;
    const timestamp = form.timestamp?.trim() || undefined;

    if (form.connector_kind === "gmail") {
      await gmailCapture.mutateAsync({
        gmail_message_id: externalMessageId || form.source_message_id,
        gmail_thread_id: externalThreadId,
        reply_to_gmail_message_id: replyToExternalMessageId,
        subject: form.title,
        sender: form.contact,
        to: form.participants ? form.participants.split(",").map((item) => item.trim()) : [],
        body: form.body,
        body_format: "plain",
        timestamp,
        metadata: {
          ...form.metadata,
          capture_source: "desktop-manual-gmail",
        },
      });
      setForm({ ...initialCapture, connector_kind: form.connector_kind });
      return;
    }

    const payload: CaptureCreate = {
      ...form,
      external_thread_id: externalThreadId,
      external_message_id: externalMessageId,
      reply_to_external_message_id: replyToExternalMessageId,
      timestamp,
      metadata: form.metadata,
    };

    await capture.mutateAsync(payload);

    setForm({ ...initialCapture, connector_kind: form.connector_kind });
  }

  function refreshDiagnostics() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.health });
    void queryClient.invalidateQueries({ queryKey: queryKeys.connectors });
    void queryClient.invalidateQueries({ queryKey: queryKeys.ollamaModels });
  }

  const telegramState = telegramAuth.data?.state ?? "disconnected";
  const canSubmitCapture = Boolean(
    form.source_message_id && form.title && form.contact && form.body,
  );

  return (
    <section className="h-full min-h-0 overflow-auto bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-6">
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Local-first preferences
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage accounts, local model behavior, background capture, privacy, storage, and runtime
            diagnostics from one place.
          </p>
        </header>

        <SectionCard
          title="Accounts / Connectors"
          description="Connect and manage local capture sources."
        >
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="rounded-lg border bg-card/50 px-3 py-2 text-sm">
                <p className="font-medium">
                  {telegramAuth.data?.connected
                    ? `Telegram connected${telegramAuth.data.username ? ` as ${telegramAuth.data.username}` : ""}`
                    : `Telegram status: ${telegramState}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {telegramAuth.data?.connected
                    ? "Incoming Telegram messages can be captured by the local runtime."
                    : "Connect with phone verification or QR code. Draftlet uses your local Telegram user session, not a bot token."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                {telegramAuth.data?.connected ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={disconnectTelegram.isPending}
                    onClick={() => disconnectTelegram.mutate()}
                  >
                    Disconnect Telegram
                  </Button>
                ) : (
                  <Button type="button" size="sm" onClick={() => setTelegramModalOpen(true)}>
                    Connect Telegram
                  </Button>
                )}
              </div>
            </div>

            {connectors.data?.length ? (
              <div className="divide-y divide-border rounded-lg border">
                {connectors.data.map((connector) => (
                  <div
                    key={connector.id}
                    className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{connector.name}</p>
                      <p className="text-xs text-muted-foreground">{connector.kind}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        updateConnector.mutate({
                          id: connector.id,
                          patch: { enabled: !connector.enabled },
                        })
                      }
                    >
                      {connector.enabled ? "Disable" : "Enable"}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No connector rows yet. Telegram can still be connected, and manual captures can
                still be ingested.
              </p>
            )}
          </div>
        </SectionCard>

        <TelegramConnectModal open={telegramModalOpen} onOpenChange={setTelegramModalOpen} />

        <SectionCard
          title="Local model / Ollama"
          description="Default local model used for new draft generations."
        >
          <div className="flex max-w-2xl flex-col gap-3">
            <Input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="gemma3:4b"
            />
            {models.data?.length ? (
              <div className="flex flex-wrap gap-2">
                {models.data.map((name) => (
                  <Button
                    key={name}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setModel(name)}
                  >
                    {name}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {models.isError
                  ? "Ollama models are unavailable."
                  : "Installed models will appear here when Ollama is reachable."}
              </p>
            )}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                onClick={() => void saveModel()}
                disabled={!model || updateSetting.isPending}
              >
                {updateSetting.isPending ? "Saving..." : "Save model"}
              </Button>
              {updateSetting.isSuccess ? (
                <span className="text-xs text-muted-foreground">Saved</span>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Background capture"
          description="Control whether Draftlet should keep local capture jobs available after the window closes."
        >
          <div className="space-y-5">
            <label className="flex max-w-3xl items-start gap-3 rounded-lg border bg-background p-3 text-sm">
              <input
                type="checkbox"
                checked={runInBackground}
                onChange={(event) => void saveRunInBackground(event.target.checked)}
                className="mt-1 size-4 rounded border-input"
              />
              <span>
                <span className="block font-medium">Run in background</span>
                <span className="mt-1 block text-muted-foreground">
                  Keep Draftlet running in the background after closing the window so connectors can
                  keep capturing.
                </span>
                {updateSetting.isPending ? (
                  <span className="mt-1 block text-xs text-muted-foreground">Saving...</span>
                ) : null}
              </span>
            </label>

            <div id="manual-capture" className="scroll-mt-6">
              <h3 className="text-sm font-semibold">Manual capture</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Create a conversation from a captured Gmail or Telegram message while background
                producers are still evolving.
              </p>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  Connector
                  <select
                    value={form.connector_kind}
                    onChange={(event) =>
                      updateForm(
                        "connector_kind",
                        event.target.value as CaptureCreate["connector_kind"],
                      )
                    }
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="gmail">Gmail</option>
                    <option value="telegram">Telegram</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Source message id
                  <Input
                    value={form.source_message_id}
                    onChange={(event) => updateForm("source_message_id", event.target.value)}
                    placeholder={form.connector_kind === "gmail" ? "gmail-message-123" : "chat:123"}
                  />
                </label>
                {form.connector_kind === "gmail" ? (
                  <>
                    <label className="flex flex-col gap-1 text-sm">
                      Gmail thread id
                      <Input
                        value={form.external_thread_id ?? ""}
                        onChange={(event) => updateForm("external_thread_id", event.target.value)}
                        placeholder="thread-a:r123"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Gmail message id
                      <Input
                        value={form.external_message_id ?? ""}
                        onChange={(event) => updateForm("external_message_id", event.target.value)}
                        placeholder="msg-a:r456"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Reply-to Gmail message id
                      <Input
                        value={form.reply_to_external_message_id ?? ""}
                        onChange={(event) =>
                          updateForm("reply_to_external_message_id", event.target.value)
                        }
                        placeholder="msg-a:r123"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Timestamp
                      <Input
                        value={form.timestamp ?? ""}
                        onChange={(event) => updateForm("timestamp", event.target.value)}
                        placeholder="2026-07-16T12:00:00Z"
                      />
                    </label>
                  </>
                ) : null}
                <label className="flex flex-col gap-1 text-sm">
                  Title
                  <Input
                    value={form.title}
                    onChange={(event) => updateForm("title", event.target.value)}
                    placeholder="Follow up on proposal"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Contact
                  <Input
                    value={form.contact}
                    onChange={(event) => updateForm("contact", event.target.value)}
                    placeholder="Avery"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Author
                  <Input
                    value={form.author ?? ""}
                    onChange={(event) => updateForm("author", event.target.value)}
                    placeholder="Avery"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Participants
                  <Input
                    value={form.participants ?? ""}
                    onChange={(event) => updateForm("participants", event.target.value)}
                    placeholder="Avery, Sreekar"
                  />
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
                <Button
                  type="button"
                  size="sm"
                  disabled={!canSubmitCapture || capture.isPending || gmailCapture.isPending}
                  onClick={() => void submitCapture()}
                >
                  {capture.isPending || gmailCapture.isPending ? "Capturing..." : "Capture message"}
                </Button>
                {capture.isSuccess || gmailCapture.isSuccess ? (
                  <span className="text-xs text-muted-foreground">Captured</span>
                ) : null}
                {capture.isError || gmailCapture.isError ? (
                  <span className="text-xs text-destructive">Capture failed</span>
                ) : null}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Privacy / Storage"
          description="Local-first data boundaries and stored runtime state."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <InfoTile
              title="Local storage"
              detail="Messages, drafts, connector rows, and settings are stored in the local Draftlet runtime database."
            />
            <InfoTile
              title="External sends"
              detail="Drafts are local until you explicitly insert them into Draftlet or confirm a supported external send."
            />
            <InfoTile
              title="Telegram session"
              detail="Telegram uses a local user session for capture and send support. Disconnect from Accounts / Connectors to stop using it."
            />
            <InfoTile
              title="Email"
              detail="Gmail threads can be captured locally. Email sending is not implemented yet."
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Diagnostics / Advanced"
          description="Live local runtime status and recent capture records."
        >
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid flex-1 gap-3 sm:grid-cols-3">
                <StatusTile
                  label="Database"
                  ok={Boolean(health.data?.database?.ok)}
                  detail={health.data?.database?.detail}
                />
                <StatusTile
                  label="Ollama"
                  ok={Boolean(health.data?.ollama?.ok)}
                  detail={health.data?.ollama?.detail}
                />
                <StatusTile
                  label="Telegram"
                  ok={Boolean(health.data?.telegram?.ok)}
                  detail={health.data?.telegram?.detail}
                />
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={refreshDiagnostics}>
                Refresh
              </Button>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Installed Ollama models</h3>
              {models.data?.length ? (
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  {models.data.map((name) => (
                    <span key={name} className="rounded-md border px-2 py-1">
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No models available.</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold">Recent captures</h3>
              {captures.data?.length ? (
                <div className="mt-2 divide-y divide-border rounded-lg border">
                  {captures.data.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-1 px-3 py-2 text-sm md:grid-cols-[1fr_auto] md:items-center"
                    >
                      <div>
                        <p className="font-medium">
                          {item.connector_kind}:{item.source_message_id}
                        </p>
                        <p className="text-xs text-muted-foreground">status: {item.status}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.captured_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No captures yet.</p>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
    </section>
  );
}

function StatusTile({ label, ok, detail }: { label: string; ok: boolean; detail?: string | null }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-sm font-medium">{label}</p>
      <p className={ok ? "mt-1 text-sm text-emerald-500" : "mt-1 text-sm text-destructive"}>
        {ok ? "Ready" : "Offline"}
      </p>
      {detail ? <p className="mt-2 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function InfoTile({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}
