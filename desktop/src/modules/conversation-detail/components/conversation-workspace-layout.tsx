import type { ReactNode } from "react";

export interface ConversationWorkspaceLayoutProps {
  thread: ReactNode;
  panel: ReactNode;
  dock: ReactNode;
}

export function ConversationWorkspaceLayout({
  thread,
  panel,
  dock,
}: ConversationWorkspaceLayoutProps) {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-6">
      <section className="min-w-0 space-y-5">
        <div className="rounded-2xl border bg-muted/20 px-3 py-4 sm:px-5 sm:py-6">{thread}</div>
        {dock}
      </section>
      <aside className="min-w-0 lg:sticky lg:top-5 lg:self-start">{panel}</aside>
    </div>
  );
}
