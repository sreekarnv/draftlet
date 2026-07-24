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
      className="bg-foreground/90 text-background ring-foreground/20 pointer-events-none absolute right-4 bottom-4 z-10 rounded-md px-3 py-1.5 text-xs font-medium shadow-md ring-1"
    >
      {toast.message}
    </div>
  );
}
