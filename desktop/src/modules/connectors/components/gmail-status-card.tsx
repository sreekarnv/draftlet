import { Link } from "react-router";

import { StatusBadge, type StatusTone } from "@/components/status-dot";
import type { Conversation } from "@/lib/contracts";
import type { ApiCapture } from "@/lib/runtime-client";
import { Button } from "@/shared/components/ui/button";
import { SectionCard } from "@/shared/components/ui/section-card";

function isGmailConversation(conversation: Conversation) {
  return conversation.connector === "gmail" || conversation.threadKind === "email";
}

function isGmailCapture(capture: ApiCapture) {
  return capture.connector_kind === "gmail";
}

function gmailStatusTone(hasRuntimeData: boolean, runtimeUnavailable: boolean): StatusTone {
  if (runtimeUnavailable) return "offline";
  return hasRuntimeData ? "ready" : "warning";
}

export function GmailStatusCard({
  conversations,
  captures,
  runtimeUnavailable,
}: {
  conversations: Conversation[];
  captures: ApiCapture[];
  runtimeUnavailable: boolean;
}) {
  const gmailConversations = conversations.filter(isGmailConversation);
  const gmailCaptures = captures.filter(isGmailCapture);
  const hasRuntimeData = gmailConversations.length > 0 || gmailCaptures.length > 0;
  const tone = gmailStatusTone(hasRuntimeData, runtimeUnavailable);
  const statusLabel = runtimeUnavailable
    ? "Runtime offline"
    : hasRuntimeData
      ? "Captures available"
      : "Ready for extension capture";

  return (
    <SectionCard
      title="Gmail"
      description="Capture selected Gmail message text with the browser extension."
    >
      <div className="space-y-4">
        <div className="bg-background flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <StatusBadge tone={tone}>{statusLabel}</StatusBadge>
            <p className="mt-3 text-sm font-medium">Gmail capture</p>
            <p className="text-muted-foreground mt-1 max-w-2xl text-xs leading-5">
              Captured Gmail threads appear in the Email workspace for review and draft generation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button asChild size="sm">
              <Link to="/email">View Gmail threads</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Metric label="Email threads" value={gmailConversations.length} />
          <Metric label="Recent Gmail captures" value={gmailCaptures.length} />
        </div>
      </div>
    </SectionCard>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-background rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}
