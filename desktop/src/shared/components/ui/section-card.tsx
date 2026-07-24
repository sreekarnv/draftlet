import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

export function SectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("bg-card ring-border/50 rounded-lg p-5 ring-1", className)}>
      <div className="mb-5">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-muted-foreground mt-1 text-xs leading-5">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
