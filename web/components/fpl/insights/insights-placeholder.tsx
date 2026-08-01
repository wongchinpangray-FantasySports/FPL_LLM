import { Link } from "@/i18n/navigation";

export function InsightsPlaceholder({
  title,
  description,
  phaseLabel,
  backHref,
  backLabel,
}: {
  title: string;
  description: string;
  phaseLabel: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-accent">
        {phaseLabel}
      </p>
      <h2 className="mt-2 text-lg font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{description}</p>
      <Link
        href={backHref}
        className="mt-5 inline-block text-sm font-medium text-brand-accent no-underline hover:underline"
      >
        {backLabel}
      </Link>
    </div>
  );
}
