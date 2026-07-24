import { useState } from "react";

import type { StatusState, StatusTone } from "@/components/status-message";
import {
  ExtensionError,
  sendCaptureGmail,
  sendExtractGmail,
  sendGetLatestGmailDraft,
  sendInsertGmailDraft,
} from "@/lib/protocol";
import { RUNTIME_DISPLAY_HOSTS } from "@/lib/runtime-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { MailCheck, RefreshCw } from "lucide-react";

type LoadingAction = "capture" | "insert" | null;

async function activeGmailTab(message: string): Promise<chrome.tabs.Tab & { id: number }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith("https://mail.google.com/")) {
    throw new ExtensionError("NOT_GMAIL_TAB", message);
  }
  return tab as chrome.tabs.Tab & { id: number };
}

function readableError(error: unknown): string {
  if (!(error instanceof ExtensionError)) {
    return error instanceof Error ? error.message : String(error);
  }

  switch (error.code) {
    case "RUNTIME_OFFLINE":
      return `Draftlet runtime is offline. Start Draftlet on ${RUNTIME_DISPLAY_HOSTS[0]}.`;
    case "RUNTIME_TIMEOUT":
      return "Draftlet runtime did not respond in time. Check that it is running locally.";
    case "RUNTIME_UNAUTHORIZED":
      return "Draftlet runtime rejected the extension token. Check your runtime auth settings.";
    case "DRAFT_NOT_FOUND":
      return "No Gmail draft found. Generate one in Draftlet first.";
    case "CONTENT_SCRIPT_UNAVAILABLE":
      return "Gmail is not ready for Draftlet yet. Refresh Gmail or open a thread, then try again.";
    case "INVALID_MESSAGE":
      return "Draftlet extension returned an unexpected response. Reload the extension and try again.";
    default:
      return error.message;
  }
}

export function App() {
  const [status, setStatus] = useState<StatusState>({
    message: "Open Gmail, select message text, then capture.",
    tone: "idle",
  });
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);

  function updateStatus(message: string, tone: StatusTone = "working") {
    setStatus({ message, tone });
  }

  function captureCurrentSelection() {
    void runAction("capture", "Reading selected Gmail text...", async () => {
      const tab = await activeGmailTab("Open a Gmail thread, select text, then capture.");
      const payload = await sendExtractGmail(tab.id);

      updateStatus("Sending selected text to Draftlet runtime...");
      const result = await sendCaptureGmail(payload);

      updateStatus(`Captured ${result.source_message_id}`, "success");
    });
  }

  function insertLatestDraft() {
    void runAction("insert", "Fetching latest Gmail draft from Draftlet...", async () => {
      const tab = await activeGmailTab("Open a Gmail reply or compose tab first.");
      const latest = await sendGetLatestGmailDraft();

      updateStatus("Inserting draft into active Gmail compose...");
      await sendInsertGmailDraft(tab.id, latest.text);

      updateStatus(
        `Inserted Draftlet reply for ${latest.subject}. Review before sending.`,
        "success",
      );
    });
  }

  async function runAction(
    action: Exclude<LoadingAction, null>,
    workingMessage: string,
    task: () => Promise<void>,
  ) {
    setLoadingAction(action);
    updateStatus(workingMessage);

    try {
      await task();
    } catch (error) {
      updateStatus(readableError(error), "error");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <>
      <main className="bg-background text-foreground w-85 p-3">
        <Card className="border-border/70 bg-card/95 overflow-hidden">
          <CardHeader>
            <div className="bg-primary/15 text-primary mb-2 flex size-9 items-center justify-center rounded-xl">
              <MailCheck className="size-5" />
            </div>
            <CardTitle>Draftlet Gmail Capture</CardTitle>
            <CardDescription>
              Select the exact Gmail text you want Draftlet to remember, then capture it locally.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full"
              disabled={loadingAction !== null}
              onClick={captureCurrentSelection}
            >
              {loadingAction === "capture" ? <RefreshCw className="animate-spin" /> : null}
              {loadingAction === "capture" ? "Capturing..." : "Capture selected Gmail text"}
            </Button>
            <Button
              className="w-full"
              disabled={loadingAction !== null}
              variant="secondary"
              onClick={insertLatestDraft}
            >
              {loadingAction === "insert" ? <RefreshCw className="animate-spin" /> : null}
              {loadingAction === "insert" ? "Inserting..." : "Insert latest Draftlet reply"}
            </Button>
            <StatusMessage status={status} />
          </CardContent>
          <CardFooter>
            <p className="text-muted-foreground text-[11px] leading-4">
              Runtime: <span className="text-foreground">{RUNTIME_DISPLAY_HOSTS[0]}</span> or{" "}
              <span className="text-foreground">{RUNTIME_DISPLAY_HOSTS[1]}</span>. Keep Gmail open
              while capturing or inserting drafts.
            </p>
          </CardFooter>
        </Card>
      </main>
    </>
  );
}
