import { useState } from "react";
import { Bot, Check, Copy, RefreshCw, Save, Send, ShieldCheck } from "lucide-react";

import { StatusBadge } from "@/components/status-dot";
import type { Conversation, Draft } from "@/lib/contracts";
import { getDraftReplyTarget } from "@/modules/conversation-detail/utils";
import { DraftVariantList } from "@/modules/draft-workspace/components/draft-variant-list";
import { SegmentedControl } from "@/modules/draft-workspace/components/segmented-control";
import { coverageOptions, lengthOptions, toneOptions } from "@/modules/draft-workspace/utils";
import { useInlineDraftController } from "@/modules/drafting/use-inline-draft-controller";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

export interface InlineDraftEditorProps {
  conversation: Conversation;
  latestDraft?: Draft;
}

export function InlineDraftEditor({ conversation, latestDraft }: InlineDraftEditorProps) {
  const draft = useInlineDraftController(conversation, latestDraft);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const replyTarget = getDraftReplyTarget(draft.draft, conversation);
  const canEdit = draft.draft && !draft.isInserted;
  const canActOnDraft = Boolean(draft.draft && draft.draftText.trim());

  async function sendViaTelegram() {
    await draft.sendTelegram();
    setSendDialogOpen(false);
  }

  return (
    <div className="bg-background/95 relative border-t p-3">
      <section className="bg-card text-card-foreground rounded-xl border shadow-sm">
        <div className="flex flex-col gap-3 border-b px-3 py-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Bot className="text-primary size-4" />
              <h2 className="text-sm font-semibold tracking-tight">Inline draft</h2>
              <StatusBadge tone={draft.isInserted ? "generating" : "ready"}>
                {draft.statusLabel}
              </StatusBadge>
              {draft.userIsEditing ? <StatusBadge tone="warning">Unsaved edits</StatusBadge> : null}
            </div>
            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
              {replyTarget
                ? `Reply target: ${replyTarget.author} · ${replyTarget.body}`
                : `Draft locally for ${conversation.title || conversation.contact}.`}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void draft.generate()}
              disabled={draft.isGenerating || draft.isGeneratingVariant}
            >
              <RefreshCw
                className={`size-3.5 ${draft.isGenerating || draft.isGeneratingVariant ? "animate-spin" : ""}`}
              />
              {draft.draft ? "Regenerate" : "Generate"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void draft.save()}
              disabled={!canEdit || draft.isSaving}
            >
              <Save className="size-3.5" />
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={draft.copy} disabled={!canActOnDraft}>
              <Copy className="size-3.5" />
              Copy
            </Button>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 p-3">
            <div className="bg-background rounded-lg border shadow-inner">
              <div className="text-muted-foreground flex items-center justify-between gap-3 border-b px-3 py-2 text-xs">
                <span>
                  {draft.draft
                    ? `${draft.activeVariantTitle} · ${draft.draft.provider}`
                    : "Composer"}
                </span>
                <span>{draft.draftText.length} chars</span>
              </div>
              <textarea
                value={draft.draftText}
                onChange={(event) => draft.setDraftText(event.target.value)}
                readOnly={draft.isInserted}
                aria-readonly={draft.isInserted}
                placeholder="Generate a draft or write one manually here."
                className="text-foreground readOnly:cursor-not-allowed readOnly:opacity-70 block max-h-80 min-h-40 w-full resize-y border-0 bg-transparent px-3 py-3 font-mono text-[13px] leading-6 outline-none"
              />
            </div>

            <div className="text-muted-foreground mt-3 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5" />
                Insert locally adds this to Draftlet only. It does not send externally.
              </p>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void draft.insert()}
                  disabled={!canEdit || !canActOnDraft || draft.isInserting}
                >
                  <Check className="size-3.5" />
                  {draft.isInserting ? "Inserting..." : "Insert locally"}
                </Button>
                {conversation.connector === "telegram" ? (
                  <Button
                    size="sm"
                    onClick={() => setSendDialogOpen(true)}
                    disabled={!draft.canSendTelegram || !canActOnDraft || draft.isSendingTelegram}
                  >
                    <Send className="size-3.5" />
                    Send Telegram
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!canActOnDraft}
                    title="Open Gmail, start a reply, then use the Draftlet extension to insert the latest reply."
                    onClick={draft.copy}
                  >
                    <Send className="size-3.5" />
                    Copy for Gmail
                  </Button>
                )}
              </div>
            </div>
          </div>

          <aside className="bg-muted/30 border-t p-3 lg:border-t-0 lg:border-l">
            <div className="space-y-3">
              <SegmentedControl
                label="Tone"
                options={toneOptions}
                value={draft.settings.tone}
                onChange={draft.setTone}
              />
              <SegmentedControl
                label="Length"
                options={lengthOptions}
                value={draft.settings.length}
                onChange={draft.setLength}
              />
              <SegmentedControl
                label="Coverage"
                options={coverageOptions}
                value={draft.settings.coverage}
                onChange={draft.setCoverage}
              />
            </div>
            <div className="mt-4">
              <p className="text-muted-foreground px-1 text-xs font-medium tracking-[0.14em] uppercase">
                Variants
              </p>
              <div className="bg-background/70 mt-2 max-h-44 overflow-auto rounded-lg border">
                <DraftVariantList
                  variants={draft.draft?.variants ?? []}
                  selectedVariant={draft.selectedVariant}
                  onSelect={draft.selectVariant}
                />
              </div>
            </div>
          </aside>
        </div>
      </section>

      {draft.toast ? (
        <div
          key={draft.toast.id}
          className="bg-popover text-popover-foreground absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border px-3 py-1.5 text-xs shadow-lg"
        >
          {draft.toast.message}
        </div>
      ) : null}

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send via Telegram?</DialogTitle>
            <DialogDescription>
              This sends externally to {conversation.title || conversation.contact}. It is separate
              from inserting the draft into Draftlet's local timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted/30 text-muted-foreground rounded-lg border p-3 text-xs">
              <p>
                Destination:{" "}
                <span className="text-foreground">
                  {conversation.title || conversation.contact}
                </span>
              </p>
              <p className="mt-1">
                Reply target:{" "}
                <span className="text-foreground">
                  {replyTarget
                    ? `${replyTarget.author}: ${replyTarget.body}`
                    : "Latest available thread context"}
                </span>
              </p>
            </div>
            <div className="bg-background max-h-56 overflow-auto rounded-lg border p-3 text-sm whitespace-pre-wrap">
              {draft.draftText || "No draft text"}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={() => void sendViaTelegram()} disabled={draft.isSendingTelegram}>
              {draft.isSendingTelegram ? "Sending..." : "Send Telegram message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
