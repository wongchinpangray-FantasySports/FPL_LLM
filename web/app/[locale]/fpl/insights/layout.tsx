export const dynamic = "force-dynamic";

type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

/** Insights are public research pages (premium soft-paywall lives on gated tiles). */
export default async function FplInsightsLayout({ children }: Props) {
  return children;
}
