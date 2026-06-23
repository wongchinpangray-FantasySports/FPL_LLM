import { setRequestLocale } from "next-intl/server";
import { HomeHub } from "@/components/home/home-hub";
import { loadHomeHubDataCached } from "@/lib/home/hub-data";

export const dynamic = "force-dynamic";

type Props = {
  params: { locale: string };
};

export default async function HomePage({ params }: Props) {
  setRequestLocale(params.locale);
  const initialData = await loadHomeHubDataCached(params.locale).catch(() => null);
  return <HomeHub initialData={initialData} />;
}
