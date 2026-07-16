import { useQuery } from "@tanstack/react-query";

import { runtimeClient } from "@/lib/runtime-client";
import { queryKeys } from "@/lib/queries/keys";

export function useHealthQuery() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: runtimeClient.health,
    refetchInterval: 15_000,
  });
}
