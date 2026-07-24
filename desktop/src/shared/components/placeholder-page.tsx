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
      <div className="bg-card text-card-foreground max-w-2xl rounded-xl border p-5">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-6">{description}</p>
        <p className="text-muted-foreground mt-5 text-xs">{note}</p>
      </div>
    </section>
  );
}
