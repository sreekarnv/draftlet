import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queries/keys";
import { runtimeClient } from "@/lib/runtime-client";

export function useConnectorsQuery() {
  return useQuery({
    queryKey: queryKeys.connectors,
    queryFn: runtimeClient.listConnectors,
    refetchInterval: 15_000,
  });
}

export function useUpdateConnector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { enabled?: boolean; config?: Record<string, unknown> };
    }) => runtimeClient.updateConnector(id, patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.connectors }),
  });
}
