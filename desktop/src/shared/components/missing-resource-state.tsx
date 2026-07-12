export interface MissingResourceStateProps {
  title: string;
  description: string;
}

export function MissingResourceState({
  title,
  description,
}: MissingResourceStateProps) {
  return (
    <section className="flex min-h-full items-center justify-center bg-background p-6">
      <div className="max-w-sm rounded-xl border border-dashed bg-card p-5 text-center text-card-foreground">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </section>
  );
}
