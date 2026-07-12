import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Coverage, Draft, DraftVariant, Length, Tone } from "@/lib/contracts";
import { queryKeys } from "@/lib/queries/keys";
import { runtimeClient } from "@/lib/runtime-client";

export function useDraftsQuery() {
  return useQuery({ queryKey: queryKeys.drafts, queryFn: runtimeClient.listDrafts });
}

export function useDraftQuery(id: string | undefined) {
  const drafts = useDraftsQuery();
  return { ...drafts, data: drafts.data?.find((item) => item.id === id) };
}

export function useGenerateDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      options,
    }: {
      conversationId: string;
      options?: { tone?: Tone; length?: Length; coverage?: Coverage };
    }) => runtimeClient.generate(conversationId, options),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.drafts });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });
}

export function useUpdateDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Draft> }) =>
      runtimeClient.updateDraft(id, patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.drafts }),
  });
}

export function useAddDraftVariant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, variant }: { id: string; variant: DraftVariant }) =>
      runtimeClient.addVariant(id, variant),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.drafts }),
  });
}

export function useAcceptDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runtimeClient.acceptDraft,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.drafts });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });
}

export function useMarkDraftSent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runtimeClient.markDraftSent,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.drafts }),
  });
}
