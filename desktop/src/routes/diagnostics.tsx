import { useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queries/keys";
import { useConnectorsQuery } from "@/lib/queries/connectors";
import { useHealthQuery } from "@/lib/queries/health";
import { useOllamaModelsQuery } from "@/lib/queries/ollama";
import { Button } from "@/shared/components/ui/button";
import { SectionCard } from "@/shared/components/ui/section-card";

export function Diagnostics() {
  const health = useHealthQuery();
  const connectors = useConnectorsQuery();
  const models = useOllamaModelsQuery();
  const queryClient = useQueryClient();

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.health });
    void queryClient.invalidateQueries({ queryKey: queryKeys.connectors });
    void queryClient.invalidateQueries({ queryKey: queryKeys.ollamaModels });
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 overflow-auto px-6 py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Runtime diagnostics
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Diagnostics</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Live status for the local runtime, Ollama provider, and connector rows.
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={refresh}>
          Refresh
        </Button>
      </header>

      <SectionCard title="Runtime health" description="Polled from /health every 15 seconds.">
        <div className="grid gap-3 sm:grid-cols-2">
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
      </SectionCard>

      <SectionCard
        title="Installed Ollama models"
        description="Model names reported by the local Ollama API."
      >
        {models.data?.length ? (
          <div className="flex flex-wrap gap-2 text-sm">
            {models.data.map((name) => (
              <span key={name} className="rounded-md border px-2 py-1">
                {name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No models available.</p>
        )}
      </SectionCard>

      <SectionCard
        title="Connectors"
        description="Connector rows currently persisted in the runtime database."
      >
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
                <span className="text-xs text-muted-foreground">
                  {connector.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No connector rows yet.</p>
        )}
      </SectionCard>
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
