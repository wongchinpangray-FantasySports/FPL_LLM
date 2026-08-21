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
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent/15 text-base font-bold text-brand-accent">
          {section.num}
        </span>
        <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
      </div>

      <ul className="flex flex-col gap-3">
        {section.bullets.map((line) => (
          <li
            key={line}
            className="relative pl-5 text-base leading-relaxed text-muted-foreground before:absolute before:left-0 before:top-[0.55em] before:h-2 before:w-2 before:rounded-full before:bg-brand-accent/70"
          >
            {line}
          </li>
        ))}
      </ul>

      {section.subsections?.map((sub) => (
        <div key={sub.label} className="mt-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-accent">
            {sub.label}
          </h3>
          <ul className="flex flex-col gap-2.5">
            {sub.bullets.map((line) => (
              <li key={line} className="text-base leading-relaxed text-muted-foreground">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {section.table ? (
        <div className="mt-5 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[320px] text-left text-base">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 font-semibold text-foreground">
                  {labels.tableAction}
                </th>
                <th className="px-4 py-3 font-semibold text-foreground">
                  {labels.tablePoints}
                </th>
              </tr>
            </thead>
            <tbody>
              {section.table.map((row) => (
                <tr key={row.action} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 text-muted-foreground">{row.action}</td>
                  <td className="px-4 py-3 font-medium tabular-nums text-foreground">
                    {row.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {section.note ? (
        <p className="mt-4 rounded-lg border border-brand-accent/20 bg-brand-accent/5 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
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
    ffScout: string;
    ffScoutBody: string;
    ffScoutNote: string;
    ffScoutScoutLink: string;
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
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-accent">
          {labels.tocTitle}
        </p>
        <ol className="flex flex-col gap-2">
          {FPL_BEGINNER_GUIDE_SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="block rounded-md px-2 py-2 text-base text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <span className="mr-1.5 font-medium text-brand-accent">{s.num}.</span>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-3.5 text-base leading-relaxed text-muted-foreground">
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
          <h2 className="text-xl font-semibold text-foreground">{labels.toolsTitle}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/fpl/insights/recommended-squad"
              className="block rounded-lg border border-border bg-card p-4 no-underline transition-colors hover:border-brand-accent/30"
            >
              <h3 className="text-base font-semibold text-foreground">{labels.recommendedSquad}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{labels.recommendedSquadBody}</p>
            </Link>
            <Link
              href="/squad-builder"
              className="block rounded-lg border border-border bg-card p-4 no-underline transition-colors hover:border-brand-accent/30"
            >
              <h3 className="text-base font-semibold text-foreground">{labels.squadBuilder}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{labels.squadBuilderBody}</p>
            </Link>
            <Link
              href="/fpl/fixtures"
              className="block rounded-lg border border-border bg-card p-4 no-underline transition-colors hover:border-brand-accent/30"
            >
              <h3 className="text-base font-semibold text-foreground">{labels.fixtures}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{labels.fixturesBody}</p>
            </Link>
            <a
              href="https://fantasyfootballscout.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-border bg-card p-4 no-underline transition-colors hover:border-brand-accent/30"
            >
              <h3 className="text-base font-semibold text-foreground">{labels.ffScout}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{labels.ffScoutBody}</p>
            </a>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {labels.ffScoutNote}{" "}
            <Link href="/scout" className="font-medium text-brand-accent underline-offset-2 hover:underline">
              {labels.ffScoutScoutLink}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
