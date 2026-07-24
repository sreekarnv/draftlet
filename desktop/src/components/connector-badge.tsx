import { Mail, MessageCircle } from "lucide-react";

import { StatusBadge, type StatusTone } from "@/components/status-dot";
import type { Connector, OllamaProviderStatus, RuntimeStatus } from "@/lib/contracts";

type BadgeStatus = RuntimeStatus | OllamaProviderStatus | "connected";

function toneFor(status: BadgeStatus): StatusTone {
  if (status === "ready" || status === "connected") {
    return "ready";
  }

  if (status === "warning") {
    return "warning";
  }

  return "offline";
}

interface ConnectorBadgeProps {
  connector: Connector;
  status?: BadgeStatus;
  label?: string;
}

export function ConnectorBadge({ connector, status = "offline", label }: ConnectorBadgeProps) {
  const resolvedLabel = label ?? (connector === "gmail" ? "Gmail" : "Telegram");
  return (
    <StatusBadge tone={toneFor(status)}>
      {connector === "gmail" ? (
        <Mail className="size-3" aria-hidden="true" />
      ) : (
        <MessageCircle className="size-3" aria-hidden="true" />
      )}
      <span>{resolvedLabel}</span>
    </StatusBadge>
  );
}
