import { INSIGHT_CATALOG } from "@/lib/fpl/insights/catalog";
import { loadPriceForecastRaw } from "@/lib/fpl/insights/price-forecast";
import { loadTransferMomentumRaw } from "@/lib/fpl/insights/transfers";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import { getMiniGameweekContext } from "@/lib/mini/gameweek";
import { getMiniOwnershipSnapshot } from "@/lib/mini/hot-picks";
import { scoreMiniSquad } from "@/lib/mini/scoring";
import type { MiniEntryRow, MiniPickStored } from "@/lib/mini/types";
import { getServerSupabase } from "@/lib/supabase";
import { getScoutArticleBySlug } from "@/lib/scout/store";
import { displayScoutExcerpt, displayScoutTitle } from "@/lib/scout/zh-status";
import { fplGet, type FplEntry, type FplHistoryResponse } from "@/lib/fpl";
import { getCachedBootstrapEventAverages } from "@/lib/fpl-bootstrap";
import { estimateAverageRank, midpointRank } from "@/lib/fpl-rank-series";
import type { ShareKind, SharePreview, SharePreviewItem } from "@/lib/share/types";

function insightFromPath(path: string) {
  return INSIGHT_CATALOG.find(
    (e) => e.href === path || path.startsWith(`${e.href}/`),
  );
}

async function priceForecastPreview(): Promise<SharePreviewItem[]> {
  const data = await loadPriceForecastRaw();
  const rise = [...data.likely_rise, ...data.watch_rise].slice(0, 4);
  const fall = [...data.likely_fall, ...data.watch_fall].slice(0, 4);
  const items: SharePreviewItem[] = [];
  for (const row of rise) {
    items.push({
      label: row.web_name,
      value: `↑ ${Math.round(Math.abs(row.progress) * 100)}%`,
      hint: `${row.team} · £${row.current_price.toFixed(1)}m`,
    });
  }
  for (const row of fall) {
    items.push({
      label: row.web_name,
      value: `↓ ${Math.round(Math.abs(row.progress) * 100)}%`,
      hint: `${row.team} · £${row.current_price.toFixed(1)}m`,
    });
  }
  return items;
}

async function transfersPreview(): Promise<SharePreviewItem[]> {
  const data = await loadTransferMomentumRaw();
  return data.rows.slice(0, 6).map((row) => ({
    label: row.web_name,
    value: row.net_transfers >= 0 ? `+${row.net_transfers}` : String(row.net_transfers),
    hint: row.team,
  }));
}

async function playerPreview(fplId: number): Promise<SharePreview | null> {
  const supa = getServerSupabase();
  const { data } = await supa
    .from("players_static")
    .select(
      "fpl_id,web_name,name,team,position,base_price,form,selected_by_percent,total_points,status,news",
    )
    .eq("fpl_id", fplId)
    .maybeSingle();
  if (!data) return null;
  const name =
    (data.web_name as string | null) ??
    (data.name as string | null) ??
    `#${fplId}`;
  const items: SharePreviewItem[] = [
    {
      label: "身价",
      value:
        data.base_price != null ? `£${Number(data.base_price).toFixed(1)}m` : "—",
    },
    {
      label: "拥有率",
      value:
        data.selected_by_percent != null
          ? `${Number(data.selected_by_percent).toFixed(1)}%`
          : "—",
    },
    {
      label: "场均",
      value: data.form != null ? String(data.form) : "—",
    },
    {
      label: "总分",
      value: data.total_points != null ? String(data.total_points) : "—",
    },
  ];
  const news = String(data.news ?? "").trim();
  if (news) {
    items.push({ label: "新闻", value: news.slice(0, 80) });
  }
  return {
    kind: "player",
    title: name,
    subtitle: [data.team, data.position].filter(Boolean).join(" · ") || null,
    href: `/player/${fplId}`,
    items,
  };
}

async function scoutPreview(slug: string): Promise<SharePreview | null> {
  const article = await getScoutArticleBySlug(slug);
  if (!article) return null;
  const excerpt = displayScoutExcerpt(article);
  return {
    kind: "scout_article",
    title: displayScoutTitle(article),
    subtitle: article.author || "Fantasy Football Scout",
    href: `/scout/${article.slug}`,
    items: excerpt ? [{ label: "摘要", value: excerpt.slice(0, 220) }] : [],
  };
}

async function miniPreview(): Promise<SharePreview> {
  const ctx = await getMiniGameweekContext();
  const gw = ctx.scoring_gw;
  const season = await getCurrentFplSeason();
  const supa = getServerSupabase();
  const { data: entries } = await supa
    .from("mini_entries")
    .select("entry_id,gw,season,entry_name,picks,captain_fpl_id,vice_fpl_id,updated_at")
    .eq("gw", gw)
    .eq("season", season)
    .limit(80);

  const rows = (entries ?? []) as MiniEntryRow[];
  const playerIds = new Set<number>();
  for (const row of rows) {
    for (const p of row.picks as MiniPickStored[]) playerIds.add(p.fpl_id);
  }

  const statsByPlayer = new Map<
    number,
    { player_id: number; total_points: number | null; minutes: number | null }
  >();
  if (playerIds.size > 0) {
    const { data: stats } = await supa
      .from("player_gw_stats")
      .select("player_id,total_points,minutes")
      .eq("gw", gw)
      .eq("season", season)
      .in("player_id", [...playerIds]);
    for (const s of stats ?? []) {
      statsByPlayer.set(s.player_id as number, {
        player_id: s.player_id as number,
        total_points: s.total_points as number | null,
        minutes: s.minutes as number | null,
      });
    }
  }

  let ownedById: Record<number, number> = {};
  let miniEntries = rows.length;
  try {
    const snap = await getMiniOwnershipSnapshot(gw, season);
    ownedById = snap.owned_by_id;
    miniEntries = snap.entries;
  } catch {
    /* optional */
  }

  const ranked = rows
    .map((row) => {
      const picks = row.picks as MiniPickStored[];
      const fplOwnedById: Record<number, number> = {};
      for (const p of picks) {
        if (p.selected_by_percent != null) {
          fplOwnedById[p.fpl_id] = p.selected_by_percent;
        }
      }
      const scored = scoreMiniSquad(
        picks.map((p) => p.fpl_id),
        row.captain_fpl_id,
        row.vice_fpl_id,
        statsByPlayer,
        { miniOwnedById: ownedById, fplOwnedById, miniEntries },
      );
      return {
        name: row.entry_name ?? `#${row.entry_id}`,
        points: scored.total,
      };
    })
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  return {
    kind: "mini_leaderboard",
    title: `Mini 5 · GW${gw} 排行`,
    subtitle: `${rows.length} 支队伍`,
    href: "/play/mini",
    items: ranked.map((row, i) => ({
      label: `#${i + 1} ${row.name}`,
      value: `${row.points} 分`,
    })),
  };
}

function formatShareRank(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("zh-CN");
}

async function managerPreview(
  entryId: number,
  fallbackTitle: string,
  href: string,
): Promise<SharePreview | null> {
  const [entry, history, bootstrap] = await Promise.all([
    fplGet<FplEntry>(`/entry/${entryId}/`).catch(() => null),
    fplGet<FplHistoryResponse>(`/entry/${entryId}/history/`).catch(() => null),
    getCachedBootstrapEventAverages().catch(() => null),
  ]);
  if (!entry) return null;
  const last = history?.current?.at(-1) ?? null;
  const fallbackAvg = midpointRank(bootstrap?.total_players);
  const avg =
    last != null
      ? estimateAverageRank(last.overall_rank, last.percentile_rank, fallbackAvg)
      : fallbackAvg;
  const rank = entry.summary_overall_rank ?? last?.overall_rank ?? null;
  const points = entry.summary_overall_points ?? last?.total_points ?? null;
  return {
    kind: "manager",
    title: entry.name?.trim() || fallbackTitle || `Entry ${entryId}`,
    subtitle: "实时战绩快照",
    href,
    items: [
      { label: "总排名", value: formatShareRank(rank) },
      { label: "平均排名", value: formatShareRank(avg) },
      { label: "总积分", value: points != null ? String(points) : "—" },
      {
        label: last?.event != null ? `GW${last.event} 得分` : "最近一轮",
        value: last?.points != null ? String(last.points) : "—",
      },
    ],
  };
}

export async function loadSharePreview(input: {
  kind: ShareKind;
  target_path: string;
  title: string;
  ref_id: string | null;
}): Promise<SharePreview> {
  const href = input.target_path;

  if (input.kind === "price_forecast") {
    const items = await priceForecastPreview().catch(() => []);
    return {
      kind: "price_forecast",
      title: input.title || "身价预测",
      subtitle: "本轮接近涨跌的球员（预览）",
      href,
      items,
    };
  }

  if (input.kind === "player") {
    const id = Number(input.ref_id || href.split("/").pop());
    const preview = Number.isFinite(id) ? await playerPreview(id) : null;
    if (preview) return preview;
  }

  if (input.kind === "scout_article") {
    const slug = input.ref_id || href.split("/").pop() || "";
    const preview = slug ? await scoutPreview(slug) : null;
    if (preview) return preview;
  }

  if (input.kind === "mini_leaderboard") {
    return miniPreview();
  }

  if (input.kind === "manager") {
    const id = Number(input.ref_id || href.split("/").pop());
    if (Number.isFinite(id) && id > 0) {
      const preview = await managerPreview(id, input.title, href).catch(
        () => null,
      );
      if (preview) return preview;
    }
    return {
      kind: "manager",
      title: input.title || "实时战绩快照",
      subtitle: "完整排名与阵容需登录后查看",
      href,
      items: [],
    };
  }

  const insight = insightFromPath(href);
  let items: SharePreviewItem[] = [];
  if (insight?.id === "transfers") {
    items = await transfersPreview().catch(() => []);
  } else if (insight?.id === "price-changes" || insight?.id === "price-forecast") {
    items = await priceForecastPreview().catch(() => []);
  }

  return {
    kind: "insight",
    title: input.title || insight?.id || "FPL 洞察",
    subtitle: "完整表格与筛选需登录后查看",
    href,
    items,
  };
}
