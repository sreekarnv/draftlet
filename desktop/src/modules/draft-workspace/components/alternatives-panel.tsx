import { RefreshCw } from "lucide-react";

import { DraftVariantList } from "@/modules/draft-workspace/components/draft-variant-list";
import type { DraftVariantListItem } from "@/modules/draft-workspace/types";
import { Button } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";

export interface AlternativesPanelProps {
  variants: DraftVariantListItem[];
  selectedVariant: string;
  isGeneratingVariant: boolean;
  onSelectVariant: (id: string) => void;
  onGenerateVariant: () => void;
}

export function AlternativesPanel({
  variants,
  selectedVariant,
  isGeneratingVariant,
  onSelectVariant,
  onGenerateVariant,
}: AlternativesPanelProps) {
  return (
    <aside className="bg-secondary/60 flex h-full min-h-0 flex-col">
      <div className="px-4 py-4">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
          Drafts
        </p>
        <h2 className="mt-1 truncate text-sm font-semibold tracking-tight">Alternatives</h2>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <DraftVariantList
          variants={variants}
          selectedVariant={selectedVariant}
          onSelect={onSelectVariant}
        />
      </ScrollArea>
      <div className="p-3">
        <Button
          className="w-full"
          size="sm"
          variant="secondary"
          onClick={onGenerateVariant}
          disabled={isGeneratingVariant}
        >
          <RefreshCw className={`size-3.5 ${isGeneratingVariant ? "animate-spin" : ""}`} />
          {isGeneratingVariant ? "Generating…" : "Generate variant"}
        </Button>
      </div>
    </aside>
  );
}
