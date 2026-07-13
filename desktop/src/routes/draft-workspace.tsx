import { useParams } from "react-router";

import { AlternativesPanel } from "@/modules/draft-workspace/components/alternatives-panel";
import { ContextPanel } from "@/modules/draft-workspace/components/context-panel";
import { EditorCanvas } from "@/modules/draft-workspace/components/editor-canvas";
import { WorkspaceToast } from "@/modules/draft-workspace/components/workspace-toast";
import { useDraftWorkspaceController } from "@/modules/draft-workspace/hooks/use-draft-workspace-controller";
import { MissingResourceState } from "@/shared/components/missing-resource-state";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/shared/components/ui/resizable";

export function DraftWorkspace() {
  const { draftId } = useParams<{ draftId: string }>();
  const workspace = useDraftWorkspaceController(draftId);

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
            userIsEditing={workspace.userIsEditing}
            onTextChange={workspace.setDraftText}
            toolbarProps={{
              title: draft.title,
              provider: draft.provider,
              draftStatus,
              onSave: workspace.save,
              onCopy: workspace.copy,
              onInsert: workspace.insert,
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
      <WorkspaceToast toast={workspace.toast} />
    </section>
  );
}
