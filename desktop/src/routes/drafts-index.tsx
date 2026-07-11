import { useEffect } from "react";
import { useNavigate } from "react-router";

import { MissingResourceState } from "@/shared/components/missing-resource-state";
import { useDraftletStore } from "@/state/draftlet-store";

export function DraftsIndex() {
  const firstDraft = useDraftletStore((s) => s.drafts[0]);
  const conversations = useDraftletStore((s) => s.conversations);
  const navigate = useNavigate();

  useEffect(() => {
    if (firstDraft) {
      void navigate(`/drafts/${firstDraft.id}`, { replace: true });
    }
  }, [firstDraft, navigate]);

  if (firstDraft) {
    return null;
  }

  const emptyDescription =
    conversations.length > 0
      ? "Open the Library and choose a conversation to generate a follow-up draft."
      : "Captured conversations will appear here once connectors bring them in.";

  return <MissingResourceState title="No drafts yet" description={emptyDescription} />;
}
