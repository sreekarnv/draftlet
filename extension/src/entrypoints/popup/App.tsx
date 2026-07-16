import { CheckCircle2, MailCheck, RefreshCw, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CaptureRead, GmailCapturePayload, RuntimeResponse } from "@/lib/runtime";
import { cn } from "@/lib/utils";

type StatusTone = "idle" | "working" | "success" | "error";

type ExtractResponse =
  | {
      ok: true;
      payload: GmailCapturePayload;
    }
  | {
      ok: false;
      error: string;
    };

export function App() {
  const [status, setStatus] = useState("Open Gmail, select message text, then capture.");
  const [tone, setTone] = useState<StatusTone>("idle");
  const [loading, setLoading] = useState(false);

  async function captureCurrentSelection() {
    setLoading(true);
    setTone("working");
    setStatus("Reading selected Gmail text...");

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url?.startsWith("https://mail.google.com/")) {
        throw new Error("Open a Gmail thread, select text, then capture.");
      }

      const extracted = await sendToGmailTab(tab.id);
      if (!extracted.ok) {
        throw new Error(extracted.error || "Could not read the Gmail thread.");
      }

      setStatus("Sending selected text to Draftlet runtime...");
      const captured = await chrome.runtime.sendMessage({
        type: "draftlet.captureGmail",
        payload: extracted.payload,
      } satisfies { type: "draftlet.captureGmail"; payload: GmailCapturePayload });
      const result = captured as RuntimeResponse<CaptureRead> | undefined;
      if (!result?.ok) {
        throw new Error(readableRuntimeError(result?.error));
      }

      setTone("success");
      setStatus(`Captured ${result.result.source_message_id}`);
    } catch (error) {
      setTone("error");
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="w-[340px] bg-background p-3 text-foreground">
      <Card className="overflow-hidden border-border/70 bg-card/95">
        <CardHeader>
          <div className="mb-2 flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <MailCheck className="size-5" />
          </div>
          <CardTitle>Draftlet Gmail Capture</CardTitle>
          <CardDescription>
            Select the exact Gmail text you want Draftlet to remember, then capture it locally.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" disabled={loading} onClick={() => void captureCurrentSelection()}>
            {loading ? <RefreshCw className="animate-spin" /> : null}
            {loading ? "Capturing..." : "Capture selected Gmail text"}
          </Button>
          <div
            className={cn(
              "rounded-xl border bg-background/70 p-3 text-xs leading-5 text-muted-foreground",
              tone === "success" && "border-primary/40 text-foreground",
              tone === "error" && "border-destructive/50 text-foreground",
            )}
          >
            <div className="flex gap-2">
              {tone === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> : null}
              {tone === "error" ? (
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              ) : null}
              <span>{status}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-[11px] leading-4 text-muted-foreground">
            Runtime: <span className="text-foreground">127.0.0.1:8000</span>. Reload Gmail after
            installing the extension.
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}

async function sendToGmailTab(tabId: number): Promise<ExtractResponse> {
  try {
    return (await chrome.tabs.sendMessage(tabId, {
      type: "draftlet.extractGmail",
    })) as ExtractResponse;
  } catch {
    throw new Error("Reload the Gmail tab after installing Draftlet, select text, then try again.");
  }
}

function readableRuntimeError(error: string | undefined): string {
  if (!error) return "Draftlet runtime rejected the capture.";
  if (error.includes("Failed to fetch")) {
    return "Draftlet runtime is offline. Start the local runtime on 127.0.0.1:8000.";
  }
  return error;
}
