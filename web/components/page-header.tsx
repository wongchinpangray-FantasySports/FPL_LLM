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
    <header className="mb-8 max-w-2xl">
      {eyebrow ? (
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-brand-accent">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-3 text-base leading-relaxed text-slate-400">
          {description}
        </p>
      ) : null}
    </header>
  );
}
