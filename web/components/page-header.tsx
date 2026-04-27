/**
 * Consistent title block for inner pages (chat, optional sections).
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
    <header className="mb-6 max-w-2xl md:mb-8">
      {eyebrow ? (
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-brand-accent">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-400 md:mt-3 md:text-base">
          {description}
        </p>
      ) : null}
    </header>
  );
}
