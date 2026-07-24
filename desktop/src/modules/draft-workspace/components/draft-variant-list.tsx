import { CheckCircle2 } from "lucide-react";

import type { DraftVariantListItem } from "@/modules/draft-workspace/types";
import { cn } from "@/shared/lib/utils";

export interface DraftVariantListProps {
  variants: DraftVariantListItem[];
  selectedVariant: string;
  onSelect: (id: string) => void;
}

export function DraftVariantList({ variants, selectedVariant, onSelect }: DraftVariantListProps) {
  if (variants.length === 0) {
    return (
      <div className="text-muted-foreground px-3 py-4 text-xs">
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
              "hover:bg-card/70 relative w-full rounded-md px-3 py-2.5 text-left",
              selected &&
                "bg-primary/10 ring-primary/20 before:bg-primary ring-1 before:absolute before:top-3 before:left-1 before:h-[calc(100%-1.5rem)] before:w-0.5 before:rounded-full",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{variant.title}</p>
                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-5">
                  {variant.detail}
                </p>
              </div>
              {selected ? (
                <CheckCircle2 className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
