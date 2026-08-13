import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { HistoricalApiDocs } from "@/components/docs/historical-api-docs";

type Props = { params: { locale: string } };

export const metadata: Metadata = {
  title: "Historical Data API · FALEAGUE",
  description:
    "Public and partner API for Fantasy Premier League historical player stats (≈2016/17–present).",
};

export default function HistoricalApiDocsPage({ params }: Props) {
  setRequestLocale(params.locale);

  return (
    <PageShell
      backHref="/"
      backLabel="Home"
      eyebrow="Developer"
      title="Historical Data API"
      description="FPL historical GW aggregates for partners and tools. Public meta/suggest; Bearer key for stats and player detail."
      width="4xl"
    >
      <HistoricalApiDocs />
    </PageShell>
  );
}
