import { Link } from "@/i18n/navigation";

/** Consistent “← Home” control for Your team features (dashboard, planner, manager). */
export function HomeBackLink({ label }: { label: string }) {
  return (
    <Link
      href="/"
      className="text-sm text-muted-foreground transition-colors hover:text-brand-accent"
    >
      {label}
    </Link>
  );
}
