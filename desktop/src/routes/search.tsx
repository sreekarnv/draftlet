import { useEffect, useState } from "react";
import { Link } from "react-router";
import { FileText, MessageSquare, Search as SearchIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { useSearchQuery } from "@/lib/queries/search";
import { Input } from "@/shared/components/ui/input";
import { ScrollArea } from "@/shared/components/ui/scroll-area";

export function Search() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const normalizedQuery = debouncedQuery.trim();
  const results = useSearchQuery(normalizedQuery);
  const items = results.data ?? [];
  const showEmptySearch = normalizedQuery.length === 0;
  const showNoResults = normalizedQuery.length > 0 && !results.isLoading && items.length === 0;

  return (
    <section className="flex min-h-full flex-col bg-background">
      <div className="border-b border-border/70 bg-background p-5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Runtime Search
        </p>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">Find drafts and memory</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Full-text search across local conversations and generated drafts.
        </p>
        <div className="relative mt-4 max-w-2xl">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search contacts, conversation text, draft replies"
            className="h-10 pl-8"
            autoFocus
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {items.length > 0 ? (
          <div className="divide-y divide-border/60">
            {items.map((item) => {
              const href = item.itemType === "draft" ? `/drafts/${item.id}` : "/library";
              const Icon = item.itemType === "draft" ? FileText : MessageSquare;

              return (
                <Link
                  key={`${item.itemType}-${item.id}`}
                  to={href}
                  className="block p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg border border-border bg-card p-2 text-muted-foreground">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-sm font-medium text-foreground">{item.title}</h2>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                          {item.itemType}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {item.snippet || "Matched this item"}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : showEmptySearch ? (
          <EmptyState title="Search your local runtime" description="Type a phrase, contact, or draft detail to search the SQLite full-text index." />
        ) : showNoResults ? (
          <EmptyState title="No search results" description="Try a different contact, phrase, or draft detail." />
        ) : (
          <EmptyState title="Searching" description="Looking through local conversations and drafts..." />
        )}
      </ScrollArea>
    </section>
  );
}
