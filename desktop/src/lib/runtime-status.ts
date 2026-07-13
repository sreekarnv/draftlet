import { useHealthQuery } from "@/lib/queries/health";

export function useRuntimeStatus() {
  const health = useHealthQuery();
  return {
    runtime: health.data?.database?.ok ? "ready" : "offline",
    ollama: health.data?.ollama?.ok ? "ready" : "offline",
    telegram: health.data?.telegram?.ok ? "ready" : "offline",
  } as const;
}
