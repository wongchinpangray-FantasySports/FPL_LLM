import { requireSignedInPage } from "@/lib/auth/require-signed-in-page";

export const dynamic = "force-dynamic";

type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

export default async function FplInsightsLayout({ children, params }: Props) {
  await requireSignedInPage(params.locale, "/fpl/insights");
  return children;
}
