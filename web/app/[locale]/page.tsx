import { setRequestLocale } from "next-intl/server";
import { HomeHub } from "@/components/home/home-hub";

/** Static shell — hub data loads client-side to stay within Worker CPU limits. */
export const dynamic = "force-static";
export const revalidate = 120;

type Props = {
  params: { locale: string };
};

/** Client fetches /api/home/hub — avoids heavy WC SSR on Cloudflare Workers. */
export default function HomePage({ params }: Props) {
  setRequestLocale(params.locale);
  return <HomeHub />;
}
