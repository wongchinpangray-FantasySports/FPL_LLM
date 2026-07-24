import { Link } from "@/i18n/navigation";
import { HomeBackLink } from "@/components/home-back-link";
import { cn } from "@/lib/utils";

type Width = "2xl" | "4xl" | "6xl";

const WIDTH: Record<Width, string> = {
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
};

/**
 * Shared page wrapper — matches home hub spacing and width (FotMob-style).
 */
export function PageShell({
  children,
  backHref,
  backLabel,
  title,
  description,
  eyebrow,
  width = "6xl",
  className,
}: {
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  title?: string;
  description?: string;
  eyebrow?: string;
  width?: Width;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-5 pb-8 md:gap-6",
        WIDTH[width],
        className,
      )}
    >
      {backHref && backLabel ? (
        backHref === "/" ? (
          <HomeBackLink label={backLabel} />
        ) : (
          <Link
            href={backHref}
            className="text-sm text-muted-foreground transition-colors hover:text-brand-accent"
          >
            {backLabel}
          </Link>
        )
      ) : null}

      {title ? (
        <header className="flex flex-col gap-1">
          {eyebrow ? (
            <p className="page-eyebrow text-[11px] font-medium uppercase tracking-[0.15em] text-brand-accent">
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
      ) : null}

      {children}
    </div>
  );
}
