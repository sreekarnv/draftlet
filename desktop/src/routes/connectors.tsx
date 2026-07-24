import { useState } from "react";
import { Link } from "react-router";

import { StatusBadge } from "@/components/status-dot";
import { useCapturesQuery } from "@/lib/queries/captures";
import { useDisconnectTelegram, useTelegramAuthStatusQuery } from "@/lib/queries/connectors";
import { useConversationsQuery } from "@/lib/queries/conversations";
import { GmailStatusCard } from "@/modules/connectors/components/gmail-status-card";
import { TelegramConnectModal } from "@/modules/connectors/components/telegram-connect-modal";
import { Button } from "@/shared/components/ui/button";
import { SectionCard } from "@/shared/components/ui/section-card";

export function Connectors() {
  const conversations = useConversationsQuery();
  const captures = useCapturesQuery();
  const telegramAuth = useTelegramAuthStatusQuery();
  const disconnectTelegram = useDisconnectTelegram();
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);

  const runtimeUnavailable = conversations.isError || captures.isError;
  const telegramConnected = Boolean(telegramAuth.data?.connected);
  const recentCaptures = [...(captures.data ?? [])]
    .sort((first, second) => Date.parse(second.captured_at) - Date.parse(first.captured_at))
    .slice(0, 5);

  return (
    <section className="bg-background h-full min-h-0 overflow-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-6">
        <header>
          <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
            Local sources
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Connectors</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            Connect the sources that bring messages into Draftlet.
          </p>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <GmailStatusCard
            conversations={conversations.data ?? []}
            captures={captures.data ?? []}
            runtimeUnavailable={runtimeUnavailable}
          />

          <SectionCard
            title="Telegram"
            description="Capture Telegram messages and send accepted drafts."
          >
            <div className="space-y-4">
              <div className="bg-background rounded-lg border p-3">
                <StatusBadge tone={telegramConnected ? "ready" : "warning"}>
                  {telegramConnected
                    ? "Connected"
                    : `Status: ${telegramAuth.data?.state ?? "unknown"}`}
                </StatusBadge>
                <p className="mt-3 text-sm font-medium">
                  {telegramConnected
                    ? `Telegram${telegramAuth.data?.username ? ` as ${telegramAuth.data.username}` : ""}`
                    : "Connect Telegram"}
                </p>
                <p className="text-muted-foreground mt-1 text-xs leading-5">
                  {telegramConnected
                    ? "Telegram is ready for message capture and supported sends."
                    : "Connect Telegram with QR code or phone verification."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {telegramConnected ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={disconnectTelegram.isPending}
                    onClick={() => disconnectTelegram.mutate()}
                  >
                    {disconnectTelegram.isPending ? "Disconnecting..." : "Disconnect Telegram"}
                  </Button>
                ) : (
                  <Button type="button" size="sm" onClick={() => setTelegramModalOpen(true)}>
                    Connect Telegram
                  </Button>
                )}
                <Button asChild size="sm" variant="secondary">
                  <Link to="/messages">View messages</Link>
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Recent activity" description="Latest captures from connected sources.">
          {recentCaptures.length ? (
            <div className="divide-border divide-y rounded-lg border">
              {recentCaptures.map((capture) => (
                <div
                  key={capture.id}
                  className="grid gap-2 px-3 py-2 text-sm sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <p className="font-medium">{formatConnectorName(capture.connector_kind)}</p>
                    <p className="text-muted-foreground text-xs">
                      {capture.status} · {capture.source_message_id}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {new Date(capture.captured_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">New captures will appear here.</p>
          )}
        </SectionCard>

        <TelegramConnectModal open={telegramModalOpen} onOpenChange={setTelegramModalOpen} />
      </div>
    </section>
  );
}

function formatConnectorName(kind: string) {
  if (kind === "gmail") return "Gmail";
  if (kind === "telegram") return "Telegram";
  return kind;
}
