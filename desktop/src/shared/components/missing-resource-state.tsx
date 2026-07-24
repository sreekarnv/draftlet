export interface MissingResourceStateProps {
  title: string;
  description: string;
}

export function MissingResourceState({ title, description }: MissingResourceStateProps) {
  return (
    <section className="bg-background flex min-h-full items-center justify-center p-6">
      <div className="bg-card text-card-foreground max-w-sm rounded-xl border border-dashed p-5 text-center">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mt-2 text-xs leading-5">{description}</p>
      </div>
    </section>
  );
}
