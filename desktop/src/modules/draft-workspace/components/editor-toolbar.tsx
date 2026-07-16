import { Copy, Save, Send } from "lucide-react";

import { Button } from "@/shared/components/ui/button";

export interface EditorToolbarProps {
  title: string;
  statusLabel: string;
  statusProvider: string;
  statusDraft: string;
  isInserted: boolean;
  draftIsSent: boolean;
  canSendTelegram: boolean;
  isSendingTelegram: boolean;
  onSave: () => void;
  onCopy: () => void;
  onInsert: () => void;
  onSendTelegram: () => void;
  onMarkSent: () => void;
}

export function EditorToolbar({
  title,
  statusLabel,
  statusProvider,
  statusDraft,
  isInserted,
  draftIsSent,
  canSendTelegram,
  isSendingTelegram,
  onSave,
  onCopy,
  onInsert,
  onSendTelegram,
  onMarkSent,
}: EditorToolbarProps) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background px-4">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold tracking-tight">{title}</h1>
        <p className="truncate text-xs text-muted-foreground">
          {statusLabel} · {statusProvider} · {statusDraft}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="px-2"
          onClick={onSave}
          disabled={isInserted}
          title={isInserted ? "This draft has already been inserted" : undefined}
        >
          <Save className="size-3.5" />
          <span className="hidden xl:inline">Save</span>
        </Button>
        <Button variant="ghost" size="sm" className="px-2" onClick={onCopy}>
          <Copy className="size-3.5" />
          <span className="hidden xl:inline">Copy</span>
        </Button>
        {canSendTelegram ? (
          <Button
            size="sm"
            className="ml-1 px-2.5"
            onClick={onSendTelegram}
            disabled={isSendingTelegram}
          >
            <Send className="size-3.5" />
            <span className="hidden lg:inline">
              {isSendingTelegram ? "Sending..." : "Send via Telegram"}
            </span>
          </Button>
        ) : null}
        {draftIsSent ? null : isInserted ? (
          <Button size="sm" variant="secondary" className="ml-1 px-2.5" onClick={onMarkSent}>
            <Send className="size-3.5" />
            <span className="hidden lg:inline">Mark as sent</span>
          </Button>
        ) : (
          <Button
            size="sm"
            className="ml-1 px-2.5"
            onClick={onInsert}
            disabled={isInserted}
            title={isInserted ? "This draft has already been inserted into Draftlet" : undefined}
          >
            <Send className="size-3.5" />
            <span className="hidden lg:inline">Insert into timeline</span>
          </Button>
        )}
      </div>
    </div>
  );
}
