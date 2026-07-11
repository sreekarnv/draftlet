import { Mail, MessageCircle } from "lucide-react";

import { StatusBadge, type StatusTone } from "@/components/status-dot";
import type { Connector, OllamaProviderStatus, RuntimeStatus } from "@/lib/contracts";

type BadgeStatus = RuntimeStatus | OllamaProviderStatus | "connected";

function iconFor(connector: Connector) {
  return connector === "Gmail" ? Mail : MessageCircle;
}

function toneFor(status: BadgeStatus): StatusTone {
  if (status === "ready" || status === "connected") {
    return "ready";
  }
  if (status === "warning") {
    return "warning";
  }
  return "offline";
}

export function ConnectorBadge({
  connector,
  status = "offline",
  label,
}: {
  connector: Connector;
  status?: BadgeStatus;
  label?: string;
}) {
  const Icon = iconFor(connector);
  const resolvedLabel = label ?? connector;
  return (
    <StatusBadge tone={toneFor(status)}>
      <Icon className="size-3" aria-hidden="true" />
      <span>{resolvedLabel}</span>
    </StatusBadge>
  );
}
