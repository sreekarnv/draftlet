import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queries/keys";
import { runtimeClient } from "@/lib/runtime-client";

export function useConversationsQuery() {
  return useQuery({ queryKey: queryKeys.conversations, queryFn: runtimeClient.listConversations });
}

export function useConversationQuery(id: string | undefined) {
  const conversations = useConversationsQuery();
  return { ...conversations, data: conversations.data?.find((item) => item.id === id) };
}

export function useMarkConversationCaptured() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runtimeClient.markConversationCaptured,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.conversations }),
  });
}
