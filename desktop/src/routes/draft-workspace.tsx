import { useState } from "react";
import { useParams } from "react-router";

import { AlternativesPanel } from "@/modules/draft-workspace/components/alternatives-panel";
import { ContextPanel } from "@/modules/draft-workspace/components/context-panel";
import { EditorCanvas } from "@/modules/draft-workspace/components/editor-canvas";
import { WorkspaceToast } from "@/modules/draft-workspace/components/workspace-toast";
import { useDraftWorkspaceController } from "@/modules/draft-workspace/hooks/use-draft-workspace-controller";
import { MissingResourceState } from "@/shared/components/missing-resource-state";
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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/components/ui/resizable";

export function DraftWorkspace() {
  const { draftId } = useParams<{ draftId: string }>();
  const workspace = useDraftWorkspaceController(draftId);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  if (!workspace.draft) {
    return (
      <MissingResourceState
        title="Draft not found"
        description="The selected draft is no longer in local memory."
      />
    );
  }

  const draft = workspace.draft;
  const activeVariant = workspace.activeVariant;
  const draftStatus = workspace.userIsEditing
    ? activeVariant
      ? `Editing · ${activeVariant.title}`
      : "Editing"
    : (activeVariant?.title ?? "Custom");

  async function sendViaTelegram() {
    await workspace.sendTelegram();
    setSendDialogOpen(false);
  }

  return (
    <section className="relative h-full min-h-0 overflow-hidden bg-background">
      <ResizablePanelGroup id="drafts" orientation="horizontal" className="h-full">
        <ResizablePanel defaultSize="22" minSize="18" maxSize="32">
          <AlternativesPanel
            variants={draft.variants}
            selectedVariant={workspace.selectedVariant}
            isGeneratingVariant={workspace.isGeneratingVariant}
            onSelectVariant={workspace.selectVariant}
            onGenerateVariant={workspace.generateVariant}
          />
        </ResizablePanel>

        <ResizableHandle className="bg-border/50" />

        <ResizablePanel defaultSize="50" minSize="34">
          <EditorCanvas
            instruction={draft.instruction}
            text={workspace.draftText}
            status={workspace.statusLabel}
            isInserted={workspace.isInserted}
            draftIsSent={workspace.draftIsSent}
            canSendTelegram={workspace.canSendTelegram}
            isSendingTelegram={workspace.isSendingTelegram}
            userIsEditing={workspace.userIsEditing}
            onTextChange={workspace.setDraftText}
            toolbarProps={{
              title: draft.title,
              provider: draft.provider,
              draftStatus,
              onSave: workspace.save,
              onCopy: workspace.copy,
              onInsert: workspace.insert,
              onSendTelegram: () => setSendDialogOpen(true),
              onMarkSent: workspace.markSent,
            }}
          />
        </ResizablePanel>

        <ResizableHandle className="bg-border/50" />

        <ResizablePanel defaultSize="28" minSize="22" maxSize="36">
          <ContextPanel
            source={workspace.source}
            settings={workspace.settings}
            onToneChange={workspace.setTone}
            onLengthChange={workspace.setLength}
            onCoverageChange={workspace.setCoverage}
            selectedMessages={draft.selectedMessages}
            references={draft.references}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send via Telegram?</DialogTitle>
            <DialogDescription>
              This will send the current draft text to the original Telegram chat. It is separate
              from inserting the draft into the local timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-56 overflow-auto rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
            {workspace.draftText || "No draft text"}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={sendViaTelegram} disabled={workspace.isSendingTelegram}>
              {workspace.isSendingTelegram ? "Sending..." : "Send message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <WorkspaceToast toast={workspace.toast} />
    </section>
  );
}
