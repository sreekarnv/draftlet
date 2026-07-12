import { useEffect, useMemo, useRef, useState } from "react";

import type { Coverage, Length, Tone } from "@/lib/contracts";
import { useConversationsQuery } from "@/lib/queries/conversations";
import { useAcceptDraft, useAddDraftVariant, useDraftQuery, useMarkDraftSent, useUpdateDraft } from "@/lib/queries/drafts";
import type { DraftWorkspaceView, WorkspaceToast } from "@/modules/draft-workspace/types";
import {
  generateDraftVariant,
  getDraftSource,
  getDraftStatusLabel,
} from "@/modules/draft-workspace/utils";

export function useDraftWorkspaceController(draftId: string | undefined): DraftWorkspaceView {
  const draft = useDraftQuery(draftId).data;
  const conversation = useConversationsQuery().data?.find((item) => item.id === draft?.conversationId);
  const updateDraft = useUpdateDraft();
  const addDraftVariant = useAddDraftVariant();
  const acceptDraft = useAcceptDraft();
  const markDraftSent = useMarkDraftSent();

  const [tone, setTone] = useState<Tone>("Direct");
  const [length, setLength] = useState<Length>("Short");
  const [coverage, setCoverage] = useState<Coverage>("Answer all points");
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [draftText, setDraftText] = useState<string>("");
  const [toast, setToast] = useState<WorkspaceToast | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastIdRef = useRef(0);

  const activeVariant = useMemo(
    () => draft?.variants.find((variant) => variant.id === selectedVariant),
    [draft, selectedVariant],
  );

  useEffect(() => {
    if (!draft) {
      setSelectedVariant("");
      setDraftText("");
      return;
    }

    const initialVariantId = draft.selectedVariantId ?? draft.variants[0]?.id ?? "";
    setSelectedVariant(initialVariantId);

    const initialVariant = draft.variants.find((variant) => variant.id === initialVariantId);
    setDraftText(initialVariant?.body ?? draft.text);
  }, [draft?.id]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const statusLabel = draft ? getDraftStatusLabel(draft.status) : "Draft";
  const isInserted = draft?.status === "accepted" || draft?.status === "sent";
  const draftIsSent = draft?.status === "sent";
  const userIsEditing = activeVariant ? draftText !== activeVariant.body : true;

  function flashToast(message: string) {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, message });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 1800);
  }

  function selectVariant(id: string) {
    setSelectedVariant(id);

    const variant = draft?.variants.find((item) => item.id === id);
    if (variant) {
      setDraftText(variant.body);
    }
  }

  function save() {
    if (!draft) {
      return;
    }

    updateDraft.mutate({ id: draft.id, patch: {
      text: draftText,
      selectedVariantId: selectedVariant || undefined,
    } });
    flashToast("Saved");
  }

  function copy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(draftText);
    }
    flashToast("Copied to clipboard");
  }

  function insert() {
    if (!draft) {
      return;
    }

    updateDraft.mutate({ id: draft.id, patch: { text: draftText } });
    acceptDraft.mutate(draft.id);
    flashToast("Inserted into conversation");
  }

  function markSent() {
    if (!draft) {
      return;
    }

    markDraftSent.mutate(draft.id);
    flashToast("Marked as sent");
  }

  function generateVariant() {
    if (!draft || !conversation) {
      return;
    }

    const variant = generateDraftVariant(conversation, {
      tone,
      length,
      coverage,
      variantNumber: draft.variants.length + 1,
    });

    addDraftVariant.mutate({ id: draft.id, variant });
    flashToast(`Variant “${variant.title}” added`);
  }

  return {
    draft,
    activeVariant,
    draftText,
    selectedVariant,
    settings: { tone, length, coverage },
    source: getDraftSource(conversation),
    statusLabel,
    isInserted,
    draftIsSent,
    userIsEditing,
    toast,
    setTone,
    setLength,
    setCoverage,
    setDraftText,
    selectVariant,
    save,
    copy,
    insert,
    markSent,
    generateVariant,
  };
}
