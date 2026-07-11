import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

import type { Draft } from "@/lib/contracts";
import { StatusBadge } from "@/components/status-dot";
import { Button } from "@/shared/components/ui/button";
import { SectionCard } from "@/shared/components/ui/section-card";

export function ContinueWorkCard({ primaryDraft }: { primaryDraft?: Draft }) {
  return (
    <SectionCard
      title="Continue work"
      description="The most relevant draft and context waiting for review."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <StatusBadge tone="offline">Runtime offline</StatusBadge>
          <span>Ollama model selected</span>
          <span>Telegram needs review</span>
        </div>
        <h2 className="max-w-2xl text-2xl font-semibold tracking-[-0.03em]">
          {primaryDraft?.title ?? "No draft selected"}
        </h2>
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
          {primaryDraft?.instruction ??
            "Captured conversations and generated drafts will appear here when there is work to continue."}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button asChild>
            <Link to={primaryDraft ? `/drafts/${primaryDraft.id}` : "/drafts"}>
              Open draft workspace
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/library">Review source context</Link>
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
