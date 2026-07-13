import { useEffect, useMemo, useRef, useState } from "react";

import type { Conversation, Coverage, Draft, Length, Tone } from "@/lib/contracts";
import {
  useAcceptDraft,
  useGenerateDraft,
  useGenerateDraftVariant,
  useSendDraftViaTelegram,
  useUpdateDraft,
} from "@/lib/queries/drafts";
import { getDraftStatusLabel } from "@/modules/draft-workspace/utils";

export type InlineDraftToast = {
  id: number;
  message: string;
};

export interface InlineDraftController {
  draft?: Draft;
  draftText: string;
  selectedVariant: string;
  settings: {
    tone: Tone;
    length: Length;
    coverage: Coverage;
  };
  statusLabel: string;
  activeVariantTitle: string;
  userIsEditing: boolean;
  isInserted: boolean;
  draftIsSent: boolean;
  canSendTelegram: boolean;
  isGenerating: boolean;
  isSaving: boolean;
  isGeneratingVariant: boolean;
  isInserting: boolean;
  isSendingTelegram: boolean;
  toast: InlineDraftToast | null;
  setTone: (value: Tone) => void;
  setLength: (value: Length) => void;
  setCoverage: (value: Coverage) => void;
  setDraftText: (value: string) => void;
  selectVariant: (id: string) => void;
  generate: () => Promise<void>;
  save: () => Promise<void>;
  copy: () => void;
  insert: () => Promise<void>;
  sendTelegram: () => Promise<void>;
}

export function useInlineDraftController(
  conversation: Conversation,
  latestDraft: Draft | undefined,
): InlineDraftController {
  const generateDraft = useGenerateDraft();
  const updateDraft = useUpdateDraft();
  const generateVariant = useGenerateDraftVariant();
  const acceptDraft = useAcceptDraft();
  const sendDraftViaTelegram = useSendDraftViaTelegram();

  const [localDraft, setLocalDraft] = useState<Draft | undefined>();
  const [tone, setTone] = useState<Tone>("Direct");
  const [length, setLength] = useState<Length>("Short");
  const [coverage, setCoverage] = useState<Coverage>("Answer all points");
  const [selectedVariant, setSelectedVariant] = useState("");
  const [draftText, setDraftText] = useState("");
  const [toast, setToast] = useState<InlineDraftToast | null>(null);
  const initializedDraftIdRef = useRef<string | undefined>(undefined);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastIdRef = useRef(0);

  const draft = localDraft?.id === latestDraft?.id ? localDraft : (latestDraft ?? localDraft);
  const activeVariant = useMemo(
    () => draft?.variants.find((variant) => variant.id === selectedVariant),
    [draft, selectedVariant],
  );

  useEffect(() => {
    if (!draft) {
      initializedDraftIdRef.current = undefined;
      setSelectedVariant("");
      setDraftText("");
      return;
    }

    if (initializedDraftIdRef.current === draft.id) {
      return;
    }

    initializedDraftIdRef.current = draft.id;
    const initialVariantId = draft.selectedVariantId ?? draft.variants[0]?.id ?? "";
    const initialVariant = draft.variants.find((variant) => variant.id === initialVariantId);
    setSelectedVariant(initialVariantId);
    setDraftText(initialVariant?.body ?? draft.text);
  }, [draft]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

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

  async function generate() {
    try {
      if (!draft) {
        const generatedDraft = await generateDraft.mutateAsync({
          conversationId: conversation.id,
          options: { tone, length, coverage },
        });
        setLocalDraft(generatedDraft);
        initializedDraftIdRef.current = undefined;
        flashToast("Draft generated");
        return;
      }

      const variant = await generateVariant.mutateAsync({
        id: draft.id,
        options: { tone, length, coverage },
      });
      const nextDraft = { ...draft, variants: [...draft.variants, variant] };
      setLocalDraft(nextDraft);
      setSelectedVariant(variant.id);
      setDraftText(variant.body);
      flashToast(`Variant “${variant.title}” generated`);
    } catch (error) {
      flashToast(error instanceof Error ? error.message : "Unable to generate draft");
    }
  }

  async function save() {
    if (!draft) return;

    const updatedDraft = await updateDraft.mutateAsync({
      id: draft.id,
      patch: { text: draftText, selectedVariantId: selectedVariant || undefined },
    });
    setLocalDraft(updatedDraft);
    flashToast("Saved");
  }

  function copy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(draftText);
    }
    flashToast("Copied to clipboard");
  }

  async function insert() {
    if (!draft) return;

    const updatedDraft = await updateDraft.mutateAsync({
      id: draft.id,
      patch: { text: draftText },
    });
    const acceptedDraft = await acceptDraft.mutateAsync(updatedDraft.id);
    setLocalDraft(acceptedDraft);
    flashToast("Inserted locally. Nothing was sent.");
  }

  async function sendTelegram() {
    if (!draft || conversation.connector !== "telegram" || draft.status === "sent") return;

    try {
      const updatedDraft = await updateDraft.mutateAsync({
        id: draft.id,
        patch: { text: draftText },
      });
      await sendDraftViaTelegram.mutateAsync({ id: updatedDraft.id, body: draftText });
      setLocalDraft({ ...updatedDraft, status: "sent" });
      flashToast("Sent via Telegram");
    } catch (error) {
      flashToast(error instanceof Error ? error.message : "Unable to send via Telegram");
    }
  }

  const userIsEditing = activeVariant ? draftText !== activeVariant.body : Boolean(draft);

  return {
    draft,
    draftText,
    selectedVariant,
    settings: { tone, length, coverage },
    statusLabel: draft ? getDraftStatusLabel(draft.status) : "No draft yet",
    activeVariantTitle: activeVariant?.title ?? "Custom",
    userIsEditing,
    isInserted: draft?.status === "accepted" || draft?.status === "sent",
    draftIsSent: draft?.status === "sent",
    canSendTelegram: conversation.connector === "telegram" && draft?.status !== "sent",
    isGenerating: generateDraft.isPending,
    isSaving: updateDraft.isPending,
    isGeneratingVariant: generateVariant.isPending,
    isInserting: acceptDraft.isPending,
    isSendingTelegram: sendDraftViaTelegram.isPending,
    toast,
    setTone,
    setLength,
    setCoverage,
    setDraftText,
    selectVariant,
    generate,
    save,
    copy,
    insert,
    sendTelegram,
  };
}
