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
      description="Extension-first local capture for email review and drafting. OAuth, Gmail API sync, and sending are deferred."
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <StatusBadge tone={tone}>{statusLabel}</StatusBadge>
            <p className="mt-3 text-sm font-medium">Selection-based Gmail capture</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              Load the Chrome extension from the repository, select the exact text in a Gmail
              thread, and capture it into Draftlet. Captures appear in the Email workspace for local
              drafting; external email sending is not implemented yet.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button asChild size="sm">
              <Link to="/email">View Gmail threads</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/settings#manual-capture">Manual capture</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Email threads" value={gmailConversations.length} />
          <Metric label="Recent Gmail captures" value={gmailCaptures.length} />
          <Metric label="External sending" value="Disabled" />
        </div>

        <div className="rounded-lg border border-dashed bg-background/60 p-3">
          <p className="text-sm font-medium">Chrome extension MVP</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Load `extension/` unpacked in Chrome, reload Gmail, select message text, then click the
            Draftlet extension. OAuth, Gmail API sync, and sending are intentionally deferred.
          </p>
          <Button className="mt-3" type="button" size="sm" variant="secondary" disabled>
            OAuth deferred
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}
