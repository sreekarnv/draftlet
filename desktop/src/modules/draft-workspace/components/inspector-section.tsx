import type { ReactNode } from "react";

export interface InspectorSectionProps {
  title: string;
  children: ReactNode;
}

export function InspectorSection({ title, children }: InspectorSectionProps) {
  return (
    <section className="space-y-3">
      <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
        {title}
      </p>
      {children}
    </section>
  );
}
