import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queries/keys";
import { runtimeClient } from "@/lib/runtime-client";

export function useConnectorsQuery() {
  return useQuery({
    queryKey: queryKeys.connectors,
    queryFn: () => runtimeClient.listConnectors(),
    refetchInterval: 15_000,
  });
}

export function useTelegramAuthStatusQuery() {
  return useQuery({
    queryKey: queryKeys.telegramAuth,
    queryFn: () => runtimeClient.telegramAuthStatus(),
    refetchInterval: (query) => (query.state.data?.connected ? 30_000 : 5_000),
  });
}

export function useStartTelegramAuth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (phone: string) => runtimeClient.startTelegramAuth(phone),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.telegramAuth }),
  });
}

export function useSignInTelegram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      phone,
      code,
      phoneCodeHash,
    }: {
      phone: string;
      code: string;
      phoneCodeHash?: string | null;
    }) => runtimeClient.signInTelegram(phone, code, phoneCodeHash),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.telegramAuth });
      void queryClient.invalidateQueries({ queryKey: queryKeys.connectors });
    },
  });
}

export function useSignInTelegramPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => runtimeClient.signInTelegramPassword(password),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.telegramAuth });
      void queryClient.invalidateQueries({ queryKey: queryKeys.connectors });
    },
  });
}

export function useDisconnectTelegram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => runtimeClient.disconnectTelegram(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.telegramAuth });
      void queryClient.invalidateQueries({ queryKey: queryKeys.telegramQrAuth });
      void queryClient.invalidateQueries({ queryKey: queryKeys.connectors });
    },
  });
}

export function useTelegramQrStatusQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.telegramQrAuth,
    queryFn: () => runtimeClient.telegramQrStatus(),
    enabled,
    refetchInterval: (query) =>
      enabled && !query.state.data?.connected && query.state.data?.state !== "expired"
        ? 1_000
        : false,
  });
}

export function useStartTelegramQr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => runtimeClient.startTelegramQr(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.telegramQrAuth });
      void queryClient.invalidateQueries({ queryKey: queryKeys.telegramAuth });
    },
  });
}

export function useCancelTelegramQr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => runtimeClient.cancelTelegramQr(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.telegramQrAuth });
      void queryClient.invalidateQueries({ queryKey: queryKeys.telegramAuth });
    },
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
