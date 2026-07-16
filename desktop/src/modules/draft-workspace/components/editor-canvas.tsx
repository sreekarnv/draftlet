import { StatusBadge } from "@/components/status-dot";
import { EditorToolbar } from "@/modules/draft-workspace/components/editor-toolbar";
import type { EditorToolbarProps } from "@/modules/draft-workspace/types";
import { ScrollArea } from "@/shared/components/ui/scroll-area";

export interface EditorCanvasProps {
  instruction: string;
  text: string;
  status: string;
  isInserted: boolean;
  draftIsSent: boolean;
  canSendTelegram: boolean;
  isSendingTelegram: boolean;
  userIsEditing: boolean;
  onTextChange: (next: string) => void;
  toolbarProps: EditorToolbarProps;
}

export function EditorCanvas({
  instruction,
  text,
  status,
  isInserted,
  draftIsSent,
  canSendTelegram,
  isSendingTelegram,
  userIsEditing,
  onTextChange,
  toolbarProps,
}: EditorCanvasProps) {
  return (
    <main className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <EditorToolbar
        title={toolbarProps.title}
        statusLabel={status}
        statusProvider={toolbarProps.provider}
        statusDraft={toolbarProps.draftStatus}
        isInserted={isInserted}
        draftIsSent={draftIsSent}
        canSendTelegram={canSendTelegram}
        isSendingTelegram={isSendingTelegram}
        onSave={toolbarProps.onSave}
        onCopy={toolbarProps.onCopy}
        onInsert={toolbarProps.onInsert}
        onSendTelegram={toolbarProps.onSendTelegram}
        onMarkSent={toolbarProps.onMarkSent}
      />
      <ScrollArea className="min-h-0 min-w-0 flex-1">
        <article className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-7 px-6 py-8 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
          <section className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Instruction
            </p>
            <p className="text-sm leading-6 text-muted-foreground">{instruction}</p>
          </section>

          <section className="rounded-lg bg-card px-6 py-7 text-card-foreground shadow-sm ring-1 ring-border/60 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Selected reply
                </p>
                <h2 className="mt-1 truncate text-2xl font-semibold tracking-[-0.03em]">
                  {status}
                </h2>
              </div>
              <StatusBadge tone={isInserted ? "generating" : "ready"}>
                {isInserted ? "Inserted" : "Local draft"}
              </StatusBadge>
            </div>
            <textarea
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              readOnly={isInserted}
              aria-readonly={isInserted}
              className="block w-full resize-none border-0 bg-transparent p-0 text-[15.5px] leading-8 text-foreground outline-none readOnly:cursor-not-allowed readOnly:opacity-70"
              rows={Math.max(6, text.split("\n").length + 2)}
            />
            {isInserted ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Inserted into Draftlet's local conversation timeline. This does not send a Telegram
                message.
              </p>
            ) : null}
            {!isInserted && userIsEditing ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Editing the selected variant. Click another variant to swap, or press Save to keep
                your changes.
              </p>
            ) : null}
          </section>
        </article>
      </ScrollArea>
    </main>
  );
}
