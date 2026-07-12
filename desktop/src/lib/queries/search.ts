import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queries/keys";
import { runtimeClient } from "@/lib/runtime-client";

export function useSearchQuery(q: string) {
  const normalizedQuery = q.trim();

  return useQuery({
    queryKey: queryKeys.search(normalizedQuery),
    queryFn: () => runtimeClient.search(normalizedQuery),
    enabled: normalizedQuery.length > 0,
  });
}
