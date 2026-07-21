import { setRequestLocale } from "next-intl/server";
import { HomeHub } from "@/components/home/home-hub";

type Props = {
  params: { locale: string };
};

/** Client fetches /api/home/hub — avoids heavy WC SSR on Cloudflare Workers. */
export default function HomePage({ params }: Props) {
  setRequestLocale(params.locale);
  return <HomeHub />;
}
