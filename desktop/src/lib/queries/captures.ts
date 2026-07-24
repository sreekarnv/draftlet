import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queries/keys";
import { runtimeClient } from "@/lib/runtime-client";

export function useCapturesQuery() {
  return useQuery({
    queryKey: queryKeys.captures,
    queryFn: () => runtimeClient.listCaptures(),
    refetchInterval: 15_000,
  });
}
