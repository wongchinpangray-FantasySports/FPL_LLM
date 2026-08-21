import { Link } from "@/i18n/navigation";
import {
  FPL_BEGINNER_GUIDE_SECTIONS,
  type GuideSection,
} from "@/lib/fpl/beginner-guide";
import { cn } from "@/lib/utils";

function SectionBlock({
  section,
  labels,
}: {
  section: GuideSection;
  labels: { tableAction: string; tablePoints: string; note: string };
}) {
  return (
    <section
      id={section.id}
      className="scroll-mt-24 rounded-xl border border-border bg-card/50 p-5 sm:p-6"
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-accent/15 text-sm font-bold text-brand-accent">
          {section.num}
        </span>
        <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
      </div>

      <ul className="flex flex-col gap-2.5">
        {section.bullets.map((line) => (
          <li
            key={line}
            className="relative pl-4 text-sm leading-relaxed text-muted-foreground before:absolute before:left-0 before:top-[0.55em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-brand-accent/70"
          >
            {line}
          </li>
        ))}
      </ul>

      {section.subsections?.map((sub) => (
        <div key={sub.label} className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-accent">
            {sub.label}
          </h3>
          <ul className="flex flex-col gap-2">
            {sub.bullets.map((line) => (
              <li key={line} className="text-sm leading-relaxed text-muted-foreground">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {section.table ? (
        <div className="mt-5 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 font-semibold text-foreground">
                  {labels.tableAction}
                </th>
                <th className="px-4 py-2.5 font-semibold text-foreground">
                  {labels.tablePoints}
                </th>
              </tr>
            </thead>
            <tbody>
              {section.table.map((row) => (
                <tr key={row.action} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2.5 text-muted-foreground">{row.action}</td>
                  <td className="px-4 py-2.5 font-medium tabular-nums text-foreground">
                    {row.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {section.note ? (
        <p className="mt-4 rounded-lg border border-brand-accent/20 bg-brand-accent/5 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-brand-accent">{labels.note} </span>
          {section.note}
        </p>
      ) : null}
    </section>
  );
}

export function FplBeginnerGuide({
  labels,
}: {
  labels: {
    tocTitle: string;
    officialRules: string;
    officialRulesLink: string;
    toolsTitle: string;
    recommendedSquad: string;
    recommendedSquadBody: string;
    squadBuilder: string;
    squadBuilderBody: string;
    fixtures: string;
    fixturesBody: string;
    tableAction: string;
    tablePoints: string;
    note: string;
    updatedNote: string;
  };
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <nav
        className={cn(
          "lg:sticky lg:top-20 lg:w-56 lg:shrink-0",
          "rounded-xl border border-border bg-card/50 p-4",
        )}
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-accent">
          {labels.tocTitle}
        </p>
        <ol className="flex flex-col gap-1.5">
          {FPL_BEGINNER_GUIDE_SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <span className="mr-1.5 font-medium text-brand-accent">{s.num}.</span>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {labels.officialRules}{" "}
          <a
            href="https://fantasy.premierleague.com/help"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-accent underline-offset-2 hover:underline"
          >
            {labels.officialRulesLink}
          </a>
          {labels.updatedNote}
        </div>

        {FPL_BEGINNER_GUIDE_SECTIONS.map((section) => (
          <SectionBlock key={section.id} section={section} labels={labels} />
        ))}

        <section className="rounded-xl border border-brand-accent/25 bg-brand-accent/5 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">{labels.toolsTitle}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Link
              href="/fpl/insights/recommended-squad"
              className="block rounded-lg border border-border bg-card p-4 no-underline transition-colors hover:border-brand-accent/30"
            >
              <h3 className="font-semibold text-foreground">{labels.recommendedSquad}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{labels.recommendedSquadBody}</p>
            </Link>
            <Link
              href="/squad-builder"
              className="block rounded-lg border border-border bg-card p-4 no-underline transition-colors hover:border-brand-accent/30"
            >
              <h3 className="font-semibold text-foreground">{labels.squadBuilder}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{labels.squadBuilderBody}</p>
            </Link>
            <Link
              href="/fpl/fixtures"
              className="block rounded-lg border border-border bg-card p-4 no-underline transition-colors hover:border-brand-accent/30"
            >
              <h3 className="font-semibold text-foreground">{labels.fixtures}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{labels.fixturesBody}</p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
