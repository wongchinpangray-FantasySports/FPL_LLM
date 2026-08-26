/**
 * Home sidebar “What’s new” feed: price rises/falls, injury flags, FFS articles.
 */

import { unstable_cache } from "next/cache";
import { fplGet } from "@/lib/fpl";
import { shanghaiDateIso } from "@/lib/fpl/wechat-daily-card";
import { getServerSupabase } from "@/lib/supabase";
import { listPublishedScoutArticles } from "@/lib/scout/store";
import { withIsolateCache } from "@/lib/worker-isolate-cache";

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

export type WhatsNewItem =
  | WhatsNewPriceItem
  | WhatsNewInjuryItem
  | WhatsNewArticleItem;

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
  cost_change_event?: number;
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
): { prices: WhatsNewPriceItem[]; injuries: WhatsNewInjuryItem[] } {
  const prices: WhatsNewPriceItem[] = [];
  const injuries: WhatsNewInjuryItem[] = [];

  for (const el of elements) {
    const team = teamsById.get(el.team);
    const teamLabel =
      (team?.short_name ?? team?.name ?? "").trim() || "—";
    const name = el.web_name?.trim() || `#${el.id}`;
    const href = `/player/${el.id}`;

    const deltaTenths = num(el.cost_change_event) ?? 0;
    if (deltaTenths !== 0) {
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
      // Skip quiet long-term absences with no news / 0% and no note.
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
    return buildFromBootstrap(elements, teamsById);
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

async function loadWhatsNewRaw(): Promise<WhatsNewData> {
  const date = shanghaiDateIso();
  const date_label = dateLabelFromIso(date);

  const [live, articles] = await Promise.all([
    loadFromLiveBootstrap(),
    listPublishedScoutArticles(8).catch(() => []),
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

  // Cap list length for a scannable sidebar.
  const rises = prices.filter((p) => p.direction === "rise").slice(0, 5);
  const falls = prices.filter((p) => p.direction === "fall").slice(0, 5);
  const injurySlice = injuries.slice(0, 8);

  const items: WhatsNewItem[] = [
    ...rises,
    ...falls,
    ...injurySlice,
    ...articleItems,
  ];

  return { date, date_label, items };
}

const loadWhatsNewCached = unstable_cache(loadWhatsNewRaw, ["home-whats-new-v1"], {
  revalidate: 180,
});

export async function loadWhatsNew(): Promise<WhatsNewData> {
  return withIsolateCache("home-whats-new-v1", 180_000, () =>
    loadWhatsNewCached(),
  );
}
