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
import type {
  CaptureRead,
  GmailCapturePayload,
  LatestGmailDraft,
  RuntimeResponse,
} from "@/lib/runtime";
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

type InsertResponse =
  | {
      ok: true;
      result: true;
    }
  | {
      ok: false;
      error: string;
    };

type LoadingAction = "capture" | "insert" | null;

export function App() {
  const [status, setStatus] = useState("Open Gmail, select message text, then capture.");
  const [tone, setTone] = useState<StatusTone>("idle");
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);

  async function captureCurrentSelection() {
    setLoadingAction("capture");
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
      setLoadingAction(null);
    }
  }

  async function insertLatestDraft() {
    setLoadingAction("insert");
    setTone("working");
    setStatus("Fetching latest Gmail draft from Draftlet...");

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url?.startsWith("https://mail.google.com/")) {
        throw new Error("Open a Gmail reply or compose tab first.");
      }

      const latest = await chrome.runtime.sendMessage({
        type: "draftlet.getLatestGmailDraft",
      } satisfies { type: "draftlet.getLatestGmailDraft" });
      const latestResult = latest as RuntimeResponse<LatestGmailDraft> | undefined;
      if (!latestResult?.ok) {
        throw new Error(
          readableRuntimeError(
            latestResult?.error,
            "No Gmail draft found. Generate one in Draftlet first.",
          ),
        );
      }

      setStatus("Inserting draft into active Gmail compose...");
      const inserted = await sendInsertToGmailTab(tab.id, latestResult.result.text);
      if (!inserted.ok) {
        throw new Error(inserted.error || "Could not insert into Gmail.");
      }

      setTone("success");
      setStatus(`Inserted Draftlet reply for ${latestResult.result.subject}. Review before sending.`);
    } catch (error) {
      setTone("error");
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingAction(null);
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
          <Button
            className="w-full"
            disabled={loadingAction !== null}
            onClick={() => void captureCurrentSelection()}
          >
            {loadingAction === "capture" ? <RefreshCw className="animate-spin" /> : null}
            {loadingAction === "capture" ? "Capturing..." : "Capture selected Gmail text"}
          </Button>
          <Button
            className="w-full"
            disabled={loadingAction !== null}
            variant="secondary"
            onClick={() => void insertLatestDraft()}
          >
            {loadingAction === "insert" ? <RefreshCw className="animate-spin" /> : null}
            {loadingAction === "insert" ? "Inserting..." : "Insert latest Draftlet reply"}
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
            Runtime: <span className="text-foreground">127.0.0.1:8765</span> or{" "}
            <span className="text-foreground">127.0.0.1:8000</span>. Reload Gmail after
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

async function sendInsertToGmailTab(tabId: number, text: string): Promise<InsertResponse> {
  try {
    return (await chrome.tabs.sendMessage(tabId, {
      type: "draftlet.insertGmailDraft",
      payload: { text },
    })) as InsertResponse;
  } catch {
    throw new Error(
      "Reload the Gmail tab after installing Draftlet, open a reply box, then try again.",
    );
  }
}

function readableRuntimeError(
  error: string | undefined,
  fallback = "Draftlet runtime rejected the request.",
): string {
  if (!error) return fallback;
  if (error.includes("Failed to fetch")) {
    return "Draftlet runtime is offline. Start Draftlet or the local runtime on 127.0.0.1:8000.";
  }
  if (error.includes("gmail_draft_not_found") || error.includes("404")) {
    return fallback;
  }
  return error;
}
