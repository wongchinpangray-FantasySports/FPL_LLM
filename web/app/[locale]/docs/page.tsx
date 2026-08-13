import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { PageShell } from "@/components/page-shell";

type Props = { params: { locale: string } };

export const metadata: Metadata = {
  title: "Developer docs · FALEAGUE",
  description: "Public API documentation for FALEAGUE partners and tools.",
};

export default function DocsIndexPage({ params }: Props) {
  setRequestLocale(params.locale);

  return (
    <PageShell
      backHref="/"
      backLabel="Home"
      eyebrow="Developer"
      title="Docs"
      description="API references for partners and integrations."
      width="4xl"
    >
      <ul className="flex flex-col gap-3">
        <li>
          <Link
            href="/docs/historical-api"
            className="block rounded-lg border border-border bg-card/40 px-4 py-3 transition-colors hover:border-brand-accent/50"
          >
            <p className="font-medium text-foreground">Historical Data API</p>
            <p className="mt-1 text-sm text-muted-foreground">
              FPL historical GW stats — public meta/suggest, Bearer for stats &
              player detail.
            </p>
          </Link>
        </li>
      </ul>
    </PageShell>
  );
}
