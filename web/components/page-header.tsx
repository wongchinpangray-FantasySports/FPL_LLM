/**
 * Compact title block — prefer PageShell for new pages.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-4 flex flex-col gap-1 md:mb-5">
      {eyebrow ? (
        <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-brand-accent">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {title}
      </h1>
      {description ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}
