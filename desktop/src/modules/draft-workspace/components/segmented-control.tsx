import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

export interface SegmentedControlProps<T> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <section className="min-w-0 space-y-2">
      <p className="text-muted-foreground truncate text-xs font-medium tracking-[0.14em] uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          const selected = option === value;

          return (
            <Button
              key={option}
              type="button"
              variant={selected ? "secondary" : "ghost"}
              size="xs"
              className={cn(selected && "bg-card text-foreground")}
              onClick={() => onChange(option)}
            >
              {option}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
