import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queries/keys";
import { runtimeClient } from "@/lib/runtime-client";

export function useOllamaModelsQuery() {
  return useQuery({
    queryKey: queryKeys.ollamaModels,
    queryFn: runtimeClient.listOllamaModels,
    refetchInterval: 60_000,
  });
}
