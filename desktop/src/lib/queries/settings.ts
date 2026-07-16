import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queries/keys";
import { runtimeClient } from "@/lib/runtime-client";

export function useSettingQuery(key: string) {
  return useQuery({
    queryKey: queryKeys.setting(key),
    queryFn: () => runtimeClient.getSetting(key),
    retry: false,
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      runtimeClient.updateSetting(key, value),
    onSuccess: (_data, variables) =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.setting(variables.key) }),
  });
}
