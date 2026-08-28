/**
 * Home sidebar “What’s new” feed: price rises/falls, injury flags, FFS articles,
 * and near rise/fall pressure for personalisation on the client.
 */

import { unstable_cache } from "next/cache";
import { fplGet } from "@/lib/fpl";
import { shanghaiDateIso } from "@/lib/fpl/wechat-daily-card";
import {
  dailyPriceDeltaTenths,
  priceMapFromBootstrap,
} from "@/lib/fpl/daily-price-snapshot";
import { getServerSupabase } from "@/lib/supabase";
import { listPublishedScoutArticles } from "@/lib/scout/store";
import { withIsolateCache } from "@/lib/worker-isolate-cache";
import {
  loadPriceForecastRaw,
  PRICE_FORECAST_WATCH,
  type PriceForecastRow,
} from "@/lib/fpl/insights/price-forecast";

export type WhatsNewPriceItem = {
  kind: "price";
  fpl_id: number;
  web_name: string;
  team: string;
  direction: "rise" | "fall";
  delta: number;
  href: string;
};

export type WhatsNewInjuryItem = {
  kind: "injury";
  fpl_id: number;
  web_name: string;
  team: string;
  /** FPL status: i = red (injured), d = yellow (doubtful). */
  status: "i" | "d";
  news: string | null;
  chance: number | null;
  href: string;
};

export type WhatsNewArticleItem = {
  kind: "article";
  id: string;
  slug: string;
  title_en: string;
  title_zh: string;
  href: string;
  published_at: string | null;
};

export type WhatsNewWatchItem = {
  kind: "watch";
  fpl_id: number;
  web_name: string;
  team: string;
  direction: "rise" | "fall";
  /** 0–1+ progress toward a £0.1 move. */
  progress: number;
  status: "likely_rise" | "watch_rise" | "likely_fall" | "watch_fall";
  href: string;
};

export type WhatsNewItem =
  | WhatsNewPriceItem
  | WhatsNewInjuryItem
  | WhatsNewArticleItem
  | WhatsNewWatchItem;

export type WhatsNewData = {
  /** Asia/Shanghai calendar date YYYY-MM-DD */
  date: string;
  /** Display as MM.DD */
  date_label: string;
  items: WhatsNewItem[];
};

type BootstrapElement = {
  id: number;
  web_name?: string;
  team: number;
  status?: string;
  news?: string;
  chance_of_playing_this_round?: number | null;
  chance_of_playing_next_round?: number | null;
  now_cost?: number;
};

type BootstrapTeam = {
  id: number;
  name?: string;
  short_name?: string;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function dateLabelFromIso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[2]}.${m[3]}`;
}

function buildFromBootstrap(
  elements: BootstrapElement[],
  teamsById: Map<number, BootstrapTeam>,
  dailyDeltaTenths: Map<number, number>,
): { prices: WhatsNewPriceItem[]; injuries: WhatsNewInjuryItem[] } {
  const prices: WhatsNewPriceItem[] = [];
  const injuries: WhatsNewInjuryItem[] = [];

  for (const el of elements) {
    const team = teamsById.get(el.team);
    const teamLabel =
      (team?.short_name ?? team?.name ?? "").trim() || "—";
    const name = el.web_name?.trim() || `#${el.id}`;
    const href = `/player/${el.id}`;

    const deltaTenths = dailyDeltaTenths.get(el.id);
    if (deltaTenths != null && deltaTenths !== 0) {
      const delta = Math.round(deltaTenths) / 10;
      prices.push({
        kind: "price",
        fpl_id: el.id,
        web_name: name,
        team: teamLabel,
        direction: delta > 0 ? "rise" : "fall",
        delta,
        href,
      });
    }

    const status = (el.status ?? "a").toLowerCase();
    if (status === "i" || status === "d") {
      const chance =
        num(el.chance_of_playing_this_round) ??
        num(el.chance_of_playing_next_round);
      const news = String(el.news ?? "").trim();
      if (status === "i" && !news && (chance == null || chance === 0)) continue;
      injuries.push({
        kind: "injury",
        fpl_id: el.id,
        web_name: name,
        team: teamLabel,
        status,
        news: news || null,
        chance,
        href,
      });
    }
  }

  prices.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  injuries.sort((a, b) => {
    if (a.status !== b.status) return a.status === "i" ? -1 : 1;
    return (a.chance ?? 99) - (b.chance ?? 99);
  });

  return { prices, injuries };
}

async function loadFromLiveBootstrap(): Promise<{
  prices: WhatsNewPriceItem[];
  injuries: WhatsNewInjuryItem[];
} | null> {
  try {
    const raw = await fplGet<{
      elements?: BootstrapElement[];
      teams?: BootstrapTeam[];
    }>("/bootstrap-static/");
    const elements = raw.elements ?? [];
    if (!elements.length) return null;
    const teamsById = new Map(
      (raw.teams ?? []).map((t) => [t.id, t] as const),
    );
    const dailyDeltaTenths = await dailyPriceDeltaTenths(
      priceMapFromBootstrap(elements),
    );
    return buildFromBootstrap(elements, teamsById, dailyDeltaTenths);
  } catch {
    return null;
  }
}

async function loadFromDb(): Promise<{
  prices: WhatsNewPriceItem[];
  injuries: WhatsNewInjuryItem[];
}> {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("players_static")
    .select("fpl_id,web_name,team,status,news,chance_of_playing")
    .in("status", ["i", "d"]);

  if (error) throw new Error(error.message);

  const injuries: WhatsNewInjuryItem[] = (data ?? [])
    .map((r) => {
      const status = String(r.status ?? "d").toLowerCase();
      if (status !== "i" && status !== "d") return null;
      const news = String(r.news ?? "").trim();
      const chance = num(r.chance_of_playing);
      if (status === "i" && !news && (chance == null || chance === 0)) {
        return null;
      }
      return {
        kind: "injury" as const,
        fpl_id: r.fpl_id as number,
        web_name: (r.web_name as string) || `#${r.fpl_id}`,
        team: (r.team as string) || "—",
        status: status as "i" | "d",
        news: news || null,
        chance,
        href: `/player/${r.fpl_id}`,
      };
    })
    .filter((x): x is WhatsNewInjuryItem => x != null)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "i" ? -1 : 1;
      return (a.chance ?? 99) - (b.chance ?? 99);
    });

  return { prices: [], injuries };
}

function toWatchItem(row: PriceForecastRow): WhatsNewWatchItem | null {
  if (
    row.status !== "likely_rise" &&
    row.status !== "watch_rise" &&
    row.status !== "likely_fall" &&
    row.status !== "watch_fall"
  ) {
    return null;
  }
  if (Math.abs(row.progress) < PRICE_FORECAST_WATCH) return null;
  return {
    kind: "watch",
    fpl_id: row.fpl_id,
    web_name: row.web_name,
    team: row.team_short || row.team,
    direction: row.progress >= 0 ? "rise" : "fall",
    progress: Math.round(Math.abs(row.progress) * 100) / 100,
    status: row.status,
    href: `/player/${row.fpl_id}`,
  };
}

async function loadWatchItems(): Promise<WhatsNewWatchItem[]> {
  try {
    const forecast = await loadPriceForecastRaw();
    const pool = [
      ...forecast.likely_rise,
      ...forecast.watch_rise,
      ...forecast.likely_fall,
      ...forecast.watch_fall,
    ];
    const seen = new Set<number>();
    const items: WhatsNewWatchItem[] = [];
    for (const row of pool.sort(
      (a, b) => Math.abs(b.progress) - Math.abs(a.progress),
    )) {
      if (seen.has(row.fpl_id)) continue;
      const item = toWatchItem(row);
      if (!item) continue;
      seen.add(row.fpl_id);
      items.push(item);
      if (items.length >= 24) break;
    }
    return items;
  } catch {
    return [];
  }
}

async function loadWhatsNewRaw(): Promise<WhatsNewData> {
  const date = shanghaiDateIso();
  const date_label = dateLabelFromIso(date);

  const [live, articles, watches] = await Promise.all([
    loadFromLiveBootstrap(),
    listPublishedScoutArticles(8).catch(() => []),
    loadWatchItems(),
  ]);

  let prices = live?.prices ?? [];
  let injuries = live?.injuries ?? [];

  if (!live) {
    try {
      const db = await loadFromDb();
      prices = db.prices;
      injuries = db.injuries;
    } catch {
      prices = [];
      injuries = [];
    }
  }

  const articleItems: WhatsNewArticleItem[] = articles.slice(0, 5).map((a) => ({
    kind: "article",
    id: a.id,
    slug: a.slug,
    title_en: a.title_en,
    title_zh: a.title_zh,
    href: `/scout/${a.slug}`,
    published_at: a.source_published_at,
  }));

  const rises = prices.filter((p) => p.direction === "rise").slice(0, 5);
  const falls = prices.filter((p) => p.direction === "fall").slice(0, 5);
  const injurySlice = injuries.slice(0, 8);

  const items: WhatsNewItem[] = [
    ...rises,
    ...falls,
    ...watches,
    ...injurySlice,
    ...articleItems,
  ];

  return { date, date_label, items };
}

const loadWhatsNewCached = unstable_cache(loadWhatsNewRaw, ["home-whats-new-v7"], {
  revalidate: 120,
});

export async function loadWhatsNew(): Promise<WhatsNewData> {
  return withIsolateCache("home-whats-new-v7", 120_000, () =>
    loadWhatsNewCached(),
  );
}
