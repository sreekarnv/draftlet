import { ActivityList } from "@/modules/home/components/activity-list";
import { ContinueWorkCard } from "@/modules/home/components/continue-work-card";
import { StatusSummary } from "@/modules/home/components/status-summary";
import {
  getFollowUpDrafts,
  getPrimaryDraft,
  getQuickActions,
  getRecentConversations,
  getStatusItems,
} from "@/modules/home/utils";
import { Button } from "@/shared/components/ui/button";
import { SectionCard } from "@/shared/components/ui/section-card";
import { useRuntimeStatus } from "@/lib/runtime-status";
import { useConversationsQuery } from "@/lib/queries/conversations";
import { useDraftsQuery } from "@/lib/queries/drafts";
import { Link } from "react-router";

export function Home() {
  const conversations = useConversationsQuery().data ?? [];
  const drafts = useDraftsQuery().data ?? [];
  const runtime = useRuntimeStatus();
  const primaryDraft = getPrimaryDraft(drafts);

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 overflow-x-hidden px-7 py-7">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Draftlet workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
            Continue the writing work that matters.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Local conversation memory, saved context, and draft follow-ups arranged for a focused
            desktop writing flow.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {getQuickActions(primaryDraft).map((action) => (
            <Button
              key={action.label}
              variant={action.primary ? "default" : "secondary"}
              size="sm"
              asChild
            >
              <Link to={action.to}>
                <action.icon className="size-3.5" />
                {action.label}
              </Link>
            </Button>
          ))}
        </div>
      </header>

      <div className="grid auto-rows-min gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ContinueWorkCard primaryDraft={primaryDraft} />

        <div className="grid auto-rows-min gap-4">
          <SectionCard
            title="Recent conversations"
            description="New local captures ready to become context."
          >
            <ActivityList
              items={getRecentConversations(conversations)}
              emptyTitle="No recent conversations"
              emptyDescription="New Gmail and Telegram Desktop captures will appear here."
            />
          </SectionCard>
          <SectionCard title="Runtime and connectors" description="Local readiness at a glance.">
            <StatusSummary
              items={getStatusItems(runtime.runtime, runtime.ollama, runtime.telegram)}
            />
          </SectionCard>
        </div>

        <SectionCard
          title="Follow-up drafts"
          description="Draft work that still needs review."
          className="xl:col-span-2"
        >
          <ActivityList
            items={getFollowUpDrafts(drafts)}
            emptyTitle="No drafts need follow-up"
            emptyDescription="Follow-up drafts will appear here when they need attention."
          />
        </SectionCard>
      </div>
    </section>
  );
}
