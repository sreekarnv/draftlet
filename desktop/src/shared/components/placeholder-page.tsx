const DEFAULT_EYEBROW = "Draftlet desktop shell";
const DEFAULT_NOTE =
  "Static placeholder. Runtime APIs, connector data, and full page workflows are intentionally not wired in this UI pass.";

export interface PlaceholderPageProps {
  title: string;
  description: string;
  eyebrow?: string;
  note?: string;
}

export function PlaceholderPage({
  title,
  description,
  eyebrow = DEFAULT_EYEBROW,
  note = DEFAULT_NOTE,
}: PlaceholderPageProps) {
  return (
    <section className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 py-5 lg:px-6">
      <div className="max-w-2xl rounded-xl border bg-card p-5 text-card-foreground">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        <p className="mt-5 text-xs text-muted-foreground">{note}</p>
      </div>
    </section>
  );
}
