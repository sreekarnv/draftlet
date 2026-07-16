import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queries/keys";
import { runtimeClient, type CaptureCreate, type GmailCaptureCreate } from "@/lib/runtime-client";

export function useCapturesQuery() {
  return useQuery({
    queryKey: queryKeys.captures,
    queryFn: () => runtimeClient.listCaptures(),
    refetchInterval: 15_000,
  });
}

export function useCaptureMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CaptureCreate) => runtimeClient.ingestCapture(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.captures });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      void queryClient.invalidateQueries({ queryKey: queryKeys.drafts });
    },
  });
}

export function useGmailCaptureMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GmailCaptureCreate) => runtimeClient.ingestGmailCapture(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.captures });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      void queryClient.invalidateQueries({ queryKey: queryKeys.drafts });
    },
  });
}
