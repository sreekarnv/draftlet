import { useState } from "react";
import { Link } from "react-router";

import { StatusBadge } from "@/components/status-dot";
import { useCapturesQuery } from "@/lib/queries/captures";
import { useConnectorsQuery, useTelegramAuthStatusQuery } from "@/lib/queries/connectors";
import { useConversationsQuery } from "@/lib/queries/conversations";
import { GmailStatusCard } from "@/modules/connectors/components/gmail-status-card";
import { TelegramConnectModal } from "@/modules/connectors/components/telegram-connect-modal";
import { Button } from "@/shared/components/ui/button";
import { SectionCard } from "@/shared/components/ui/section-card";

export function Connectors() {
  const conversations = useConversationsQuery();
  const captures = useCapturesQuery();
  const connectors = useConnectorsQuery();
  const telegramAuth = useTelegramAuthStatusQuery();
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);

  const runtimeUnavailable = conversations.isError || captures.isError;
  const telegramConnected = Boolean(telegramAuth.data?.connected);

  return (
    <section className="h-full min-h-0 overflow-auto bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-6">
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Local sources
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Connectors</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage capture sources for local drafting. Gmail is currently extension-first and
            Telegram uses a local user session.
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
            description="Local user-session capture and supported message sending."
          >
            <div className="space-y-4">
              <div className="rounded-lg border bg-background p-3">
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
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Telegram can capture incoming messages and send accepted drafts through the
                  runtime.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {telegramConnected ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/settings">Manage in Settings</Link>
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

        <SectionCard
          title="Connector rows"
          description="Runtime connector records and enabled state."
        >
          {connectors.data?.length ? (
            <div className="divide-y divide-border rounded-lg border">
              {connectors.data.map((connector) => (
                <div
                  key={connector.id}
                  className="grid gap-2 px-3 py-2 text-sm sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <p className="font-medium">{connector.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {connector.kind} · {connector.enabled ? "enabled" : "disabled"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Updated {new Date(connector.updated_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No connector rows yet. Gmail manual captures and Telegram auth can still work without
              a stored connector row.
            </p>
          )}
        </SectionCard>

        <TelegramConnectModal open={telegramModalOpen} onOpenChange={setTelegramModalOpen} />
      </div>
    </section>
  );
}
