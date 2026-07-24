import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useCapturesQuery } from "@/lib/queries/captures";
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
import { ManualCaptureForm } from "@/modules/settings/components/manual-capture-form";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { SectionCard } from "@/shared/components/ui/section-card";

const OLLAMA_MODEL_KEY = "ollama_default_model";
const RUN_IN_BACKGROUND_KEY = "run_in_background";

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
  const queryClient = useQueryClient();

  const [model, setModel] = useState("");
  const [runInBackground, setRunInBackground] = useState(false);
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);

  useEffect(() => {
    if (typeof modelSetting.data?.value === "string") {
      setModel(modelSetting.data.value);
    }
  }, [modelSetting.data?.value]);

  useEffect(() => {
    setRunInBackground(backgroundSetting.data?.value === true);
  }, [backgroundSetting.data?.value]);

  async function saveModel() {
    await updateSetting.mutateAsync({ key: OLLAMA_MODEL_KEY, value: model });
  }

  async function saveRunInBackground(value: boolean) {
    setRunInBackground(value);
    await updateSetting.mutateAsync({ key: RUN_IN_BACKGROUND_KEY, value });
  }

  function refreshDiagnostics() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.health });
    void queryClient.invalidateQueries({ queryKey: queryKeys.connectors });
    void queryClient.invalidateQueries({ queryKey: queryKeys.ollamaModels });
  }

  const telegramState = telegramAuth.data?.state ?? "disconnected";

  return (
    <section className="bg-background h-full min-h-0 overflow-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-6">
        <header>
          <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
            Local-first preferences
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
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
              <div className="bg-card/50 rounded-lg border px-3 py-2 text-sm">
                <p className="font-medium">
                  {telegramAuth.data?.connected
                    ? `Telegram connected${telegramAuth.data.username ? ` as ${telegramAuth.data.username}` : ""}`
                    : `Telegram status: ${telegramState}`}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
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
              <div className="divide-border divide-y rounded-lg border">
                {connectors.data.map((connector) => (
                  <div
                    key={connector.id}
                    className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{connector.name}</p>
                      <p className="text-muted-foreground text-xs">{connector.kind}</p>
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
              <p className="text-muted-foreground text-sm">
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
              <p className="text-muted-foreground text-xs">
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
                <span className="text-muted-foreground text-xs">Saved</span>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Background capture"
          description="Control whether Draftlet should keep local capture jobs available after the window closes."
        >
          <div className="space-y-5">
            <label className="bg-background flex max-w-3xl items-start gap-3 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                checked={runInBackground}
                onChange={(event) => void saveRunInBackground(event.target.checked)}
                className="border-input mt-1 size-4 rounded"
              />
              <span>
                <span className="block font-medium">Run in background</span>
                <span className="text-muted-foreground mt-1 block">
                  Keep Draftlet running in the background after closing the window so connectors can
                  keep capturing.
                </span>
                {updateSetting.isPending ? (
                  <span className="text-muted-foreground mt-1 block text-xs">Saving...</span>
                ) : null}
              </span>
            </label>

            <ManualCaptureForm />
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
                <p className="text-muted-foreground mt-2 text-sm">No models available.</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold">Recent captures</h3>
              {captures.data?.length ? (
                <div className="divide-border mt-2 divide-y rounded-lg border">
                  {captures.data.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-1 px-3 py-2 text-sm md:grid-cols-[1fr_auto] md:items-center"
                    >
                      <div>
                        <p className="font-medium">
                          {item.connector_kind}:{item.source_message_id}
                        </p>
                        <p className="text-muted-foreground text-xs">status: {item.status}</p>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {new Date(item.captured_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground mt-2 text-sm">No captures yet.</p>
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
    <div className="bg-background rounded-lg border p-3">
      <p className="text-sm font-medium">{label}</p>
      <p className={ok ? "mt-1 text-sm text-emerald-500" : "text-destructive mt-1 text-sm"}>
        {ok ? "Ready" : "Offline"}
      </p>
      {detail ? <p className="text-muted-foreground mt-2 text-xs">{detail}</p> : null}
    </div>
  );
}

function InfoTile({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="bg-background rounded-lg border p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 text-xs leading-5">{detail}</p>
    </div>
  );
}
