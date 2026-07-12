import type { WorkspaceToast as WorkspaceToastState } from "@/modules/draft-workspace/types";

export interface WorkspaceToastProps {
  toast: WorkspaceToastState | null;
}

export function WorkspaceToast({ toast }: WorkspaceToastProps) {
  if (!toast) {
    return null;
  }

  return (
    <div
      key={toast.id}
      className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-md bg-foreground/90 px-3 py-1.5 text-xs font-medium text-background shadow-md ring-1 ring-foreground/20"
    >
      {toast.message}
    </div>
  );
}
