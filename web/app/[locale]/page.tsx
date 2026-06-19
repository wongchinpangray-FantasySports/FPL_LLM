import { HomeHub } from "@/components/home/home-hub";
import { loadHomeHubData } from "@/lib/home/hub-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await loadHomeHubData();
  return <HomeHub data={data} />;
}
