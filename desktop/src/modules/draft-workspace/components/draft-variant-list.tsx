import { CheckCircle2 } from "lucide-react";

import type { DraftVariantListItem } from "@/modules/draft-workspace/types";
import { cn } from "@/shared/lib/utils";


export interface DraftVariantListProps {
  variants: DraftVariantListItem[];
  selectedVariant: string;
  onSelect: (id: string) => void;
}

export function DraftVariantList({
  variants,
  selectedVariant,
  onSelect,
}: DraftVariantListProps) {
  if (variants.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-muted-foreground">
        No variants yet. Use “Generate variant” to create one.
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {variants.map((variant) => {
        const selected = variant.id === selectedVariant;

        return (
          <button
            key={variant.id}
            type="button"
            onClick={() => onSelect(variant.id)}
            className={cn(
              "relative w-full rounded-md px-3 py-2.5 text-left hover:bg-card/70",
              selected &&
                "bg-primary/10 ring-1 ring-primary/20 before:absolute before:left-1 before:top-3 before:h-[calc(100%-1.5rem)] before:w-0.5 before:rounded-full before:bg-primary",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{variant.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {variant.detail}
                </p>
              </div>
              {selected ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
