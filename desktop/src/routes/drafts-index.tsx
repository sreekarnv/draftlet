import { useEffect } from "react";
import { useNavigate } from "react-router";

import { useConversationsQuery } from "@/lib/queries/conversations";
import { useDraftsQuery } from "@/lib/queries/drafts";
import { MissingResourceState } from "@/shared/components/missing-resource-state";

export function DraftsIndex() {
  const firstDraft = useDraftsQuery().data?.[0];
  const conversations = useConversationsQuery().data ?? [];
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
